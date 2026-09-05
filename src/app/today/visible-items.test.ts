import { describe, expect, it } from "vitest";
import { isVisibleToday } from "./visible-items";

const today = "2026-08-19";
const noScheduledItems = new Set<string>();

describe("isVisibleToday", () => {
  it("keeps an unfinished undated task from a previous day visible", () => {
    expect(
      isVisibleToday(
        {
          id: "fed-10",
          due_at: null,
          planned_date: "2026-08-18",
        },
        today,
        noScheduledItems,
      ),
    ).toBe(true);
  });

  it("keeps tasks planned for today visible", () => {
    expect(
      isVisibleToday(
        {
          id: "today-task",
          due_at: "2026-08-22T06:59:00.000Z",
          planned_date: today,
        },
        today,
        noScheduledItems,
      ),
    ).toBe(true);
  });

  it("keeps scheduled tasks visible", () => {
    expect(
      isVisibleToday(
        {
          id: "scheduled-task",
          due_at: null,
          planned_date: null,
        },
        today,
        new Set(["scheduled-task"]),
      ),
    ).toBe(true);
  });

  it("does not pull future undated tasks into Today early", () => {
    expect(
      isVisibleToday(
        {
          id: "future-task",
          due_at: null,
          planned_date: "2026-08-20",
        },
        today,
        noScheduledItems,
      ),
    ).toBe(false);
  });

  it("keeps open tasks without a planned date visible", () => {
    expect(
      isVisibleToday(
        {
          id: "backlog-task",
          due_at: null,
          planned_date: null,
        },
        today,
        noScheduledItems,
      ),
    ).toBe(true);
  });

  it("keeps an unfinished dated task from a previous day visible", () => {
    expect(
      isVisibleToday(
        {
          id: "old-dated-task",
          due_at: "2026-08-18T23:59:00.000Z",
          planned_date: "2026-08-18",
        },
        today,
        noScheduledItems,
      ),
    ).toBe(true);
  });
});
