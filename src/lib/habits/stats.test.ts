import { describe, expect, it } from "vitest";
import { calculateHabitStats } from "./stats";

describe("habit stats", () => {
  it("calculates streaks and caps completion at 100 percent", () => {
    const stats = calculateHabitStats(
      ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"],
      new Date("2026-07-16T12:00:00.000Z"),
      1,
    );
    expect(stats.currentStreak).toBe(4);
    expect(stats.longestStreak).toBe(4);
    expect(stats.completionRate).toBeLessThanOrEqual(100);
  });
});
