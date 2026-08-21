import { beforeEach, describe, expect, it, vi } from "vitest";

const adminMock = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminMock,
}));

import { addPlannerItem, getPlanningContext } from "./service";

type QueryResult = {
  data: unknown;
  error: null;
};

function query(result: QueryResult) {
  let current = result;
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn((value: unknown) => {
      adminMock.insert(value);
      return builder;
    }),
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
    adminMock.insert.mockReset();
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

  it("gives future assignments a finish-early session budget", async () => {
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
        items: {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000012",
              parent_id: null,
              title: "Write research paper",
              description: null,
              course: "English",
              due_at: "2026-07-31T06:59:00.000Z",
              planned_date: null,
              priority: "normal",
              energy: "high",
              est_minutes: 300,
              remaining_minutes: 300,
              actual_minutes: 0,
              is_project: false,
              step_order: null,
              origin: "feed",
            },
          ],
          error: null,
        },
        events: { data: [], error: null },
        blocks: { data: [], error: null },
        habits: { data: [], error: null },
        habit_logs: { data: [], error: null },
        planner_runs: { data: [], error: null },
      };
      return query(results[table] ?? { data: [], error: null });
    });

    const result = await getPlanningContext(
      "00000000-0000-4000-8000-000000000001",
      { from_date: "2026-07-22", to_date: "2026-07-29" },
    );

    expect(result).toMatchObject({
      items: [
        {
          title: "Write research paper",
          scheduling_guidance: {
            target_completion_date: "2026-07-27",
            must_start_by: "2026-07-24",
            buffer_days: 3,
            recommended_sessions: 4,
            recommended_session_minutes: 75,
            urgency: "planned_ahead",
          },
        },
      ],
    });
  });

  it("marks tasks added through the planner as AI-originated", async () => {
    adminMock.from.mockImplementation(() =>
      query({
        data: {
          id: "00000000-0000-4000-8000-000000000020",
          title: "Draft history outline",
          description: null,
          due_at: null,
          planned_date: null,
          est_minutes: null,
          course: null,
          energy: "medium",
          is_project: false,
        },
        error: null,
      }),
    );

    await addPlannerItem("00000000-0000-4000-8000-000000000001", {
      title: "Draft history outline",
    });

    expect(adminMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Draft history outline",
        origin: "ai",
      }),
    );
  });
});
