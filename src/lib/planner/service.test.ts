import { beforeEach, describe, expect, it, vi } from "vitest";

const adminMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminMock,
}));

import { getPlanningContext } from "./service";

type QueryResult = {
  data: unknown;
  error: null;
};

function query(result: QueryResult) {
  let current = result;
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    or: vi.fn(() => {
      const rows = Array.isArray(current.data) ? current.data : [];
      current = {
        data: rows.filter((row) => {
          if (typeof row !== "object" || row === null) return false;
          const block = row as { locked?: boolean; origin?: string };
          return block.locked === true || block.origin === "manual";
        }),
        error: null,
      };
      return builder;
    }),
    single: vi.fn(async () => current),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(current).then(resolve, reject),
  };
  return builder;
}

describe("getPlanningContext", () => {
  beforeEach(() => {
    adminMock.from.mockReset();
    adminMock.from.mockImplementation((table: string) => {
      const results: Record<string, QueryResult> = {
        users: {
          data: {
            timezone: "America/Los_Angeles",
            working_hours_json: null,
            planner_prefs_json: null,
          },
          error: null,
        },
        items: { data: [], error: null },
        events: { data: [], error: null },
        blocks: {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000010",
              item_id: "00000000-0000-4000-8000-000000000011",
              title: "Review Systems Design",
              start_at: "2026-07-22T20:00:00.000Z",
              end_at: "2026-07-22T21:00:00.000Z",
              origin: "ai",
              locked: false,
              reason: "Review before the midterm window opens.",
            },
          ],
          error: null,
        },
        habits: { data: [], error: null },
        habit_logs: { data: [], error: null },
        planner_runs: { data: [], error: null },
      };
      return query(results[table] ?? { data: [], error: null });
    });
  });

  it("returns AI blocks for write verification without treating them as protected", async () => {
    const result = await getPlanningContext(
      "00000000-0000-4000-8000-000000000001",
      { from_date: "2026-07-22", to_date: "2026-07-29" },
    );

    expect(result).toMatchObject({
      scheduled_blocks: [
        {
          title: "Review Systems Design",
          origin: "ai",
          locked: false,
        },
      ],
      protected_blocks: [],
    });
  });
});
