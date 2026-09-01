import { describe, expect, it } from "vitest";
import {
  schoolDayRailStartHour,
  schoolDismissalMinutes,
  withSchoolDayWindows,
} from "./school-schedule";

describe("school schedule", () => {
  it("uses 4pm dismissal on Monday, Tuesday, and Thursday", () => {
    expect([1, 2, 4].map(schoolDismissalMinutes)).toEqual([960, 960, 960]);
  });

  it("uses 3:15pm dismissal on Wednesday and Friday", () => {
    expect([3, 5].map(schoolDismissalMinutes)).toEqual([915, 915]);
    expect(schoolDayRailStartHour(3, 7)).toBe(15);
  });

  it("keeps the configured wake hour on weekends", () => {
    expect(schoolDayRailStartHour(6, 8)).toBe(8);
  });

  it("adds school windows without removing personal blocked time", () => {
    expect(
      withSchoolDayWindows({
        wake: 7,
        sleep: 23,
        blockedWindows: [{ days: [1], start: "18:00", end: "19:00" }],
      }).blockedWindows,
    ).toEqual([
      { days: [1], start: "18:00", end: "19:00" },
      { days: [1, 2, 4], start: "00:00", end: "16:00" },
      { days: [3, 5], start: "00:00", end: "15:15" },
    ]);
  });
});
