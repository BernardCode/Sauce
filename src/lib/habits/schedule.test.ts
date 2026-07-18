import { describe, expect, it } from "vitest";
import { buildHabitSchedule } from "./schedule";

describe("habit schedule", () => {
  it("places a timed daily habit on every requested date", () => {
    const entries = buildHabitSchedule(
      ["2026-07-18", "2026-07-19"],
      [{
        id: "habit-1",
        name: "Read",
        cadence: "daily",
        days: [],
        scheduledTime: "19:30",
      }],
      new Set(),
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ date: "2026-07-18", scheduledTime: "19:30" });
  });

  it("omits untimed habits and dates outside a custom cadence", () => {
    const entries = buildHabitSchedule(
      ["2026-07-20", "2026-07-21"],
      [
        { id: "habit-1", name: "Read", cadence: "daily", days: [], scheduledTime: null },
        { id: "habit-2", name: "Run", cadence: "custom", days: [2], scheduledTime: "07:00" },
      ],
      new Set(),
    );

    expect(entries).toEqual([
      expect.objectContaining({ habitId: "habit-2", date: "2026-07-21" }),
    ]);
  });

  it("carries completion state into the calendar entry", () => {
    const entries = buildHabitSchedule(
      ["2026-07-18"],
      [{ id: "habit-1", name: "Read", cadence: "daily", days: [], scheduledTime: "19:30" }],
      new Set(["habit-1:2026-07-18"]),
    );

    expect(entries[0]?.done).toBe(true);
  });
});
