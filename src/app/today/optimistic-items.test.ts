import { describe, expect, it } from "vitest";
import type { TodayItem } from "./task-types";
import { updateOptimisticItems } from "./optimistic-items";

const task: TodayItem = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Read chapter five",
  course: "English",
  dueAt: null,
  plannedDate: "2026-07-22",
  estMinutes: 30,
  isProject: false,
  isLater: false,
  origin: "manual",
};

describe("updateOptimisticItems", () => {
  it("shows a new task before the server responds", () => {
    const optimisticTask = {
      ...task,
      id: "22222222-2222-4222-8222-222222222222",
      optimistic: true,
    };

    expect(
      updateOptimisticItems([task], { type: "add", item: optimisticTask }),
    ).toEqual([task, optimisticTask]);
  });

  it("hides a completed task before the server responds", () => {
    expect(
      updateOptimisticItems([task], { type: "complete", id: task.id }),
    ).toEqual([]);
  });

  it("moves a task between Main and Later before the server responds", () => {
    expect(
      updateOptimisticItems([task], {
        type: "move",
        id: task.id,
        destination: "later",
      }),
    ).toEqual([{ ...task, isLater: true }]);
  });
});
