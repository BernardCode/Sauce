import { describe, expect, it } from "vitest";
import { partitionTodayItems } from "./task-lists";

const today = "2026-08-31";
const items = [
  {
    id: "main",
    due_at: null,
    planned_date: today,
  },
  {
    id: "later",
    due_at: null,
    planned_date: null,
  },
  {
    id: "scheduled-later",
    due_at: "2026-09-01T06:59:00.000Z",
    planned_date: null,
  },
  {
    id: "backlog",
    due_at: null,
    planned_date: null,
  },
];

describe("partitionTodayItems", () => {
  it("keeps personal Later items out of Main", () => {
    const result = partitionTodayItems(
      items,
      today,
      new Set<string>(),
      new Set(["later", "scheduled-later"]),
    );

    expect(result.main.map((item) => item.id)).toEqual(["main"]);
    expect(result.later.map((item) => item.id)).toEqual([
      "later",
      "scheduled-later",
    ]);
  });

  it("returns a Later item to Main when Codex schedules it today", () => {
    const result = partitionTodayItems(
      items,
      today,
      new Set(["scheduled-later"]),
      new Set(["later", "scheduled-later"]),
    );

    expect(result.main.map((item) => item.id)).toEqual([
      "main",
      "scheduled-later",
    ]);
    expect(result.later.map((item) => item.id)).toEqual(["later"]);
  });
});
