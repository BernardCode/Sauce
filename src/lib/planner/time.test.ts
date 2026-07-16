import { describe, expect, it } from "vitest";
import {
  clockMinutes,
  intervalsOverlap,
  localParts,
  minutesBetween,
  safeTimeZone,
  utcRangeBounds,
} from "./time";

describe("planner time helpers", () => {
  it("uses half-open overlap semantics", () => {
    const nine = new Date("2026-07-16T09:00:00Z");
    const ten = new Date("2026-07-16T10:00:00Z");
    const eleven = new Date("2026-07-16T11:00:00Z");
    expect(intervalsOverlap({ start: nine, end: ten }, { start: ten, end: eleven })).toBe(false);
    expect(
      intervalsOverlap(
        { start: nine, end: eleven },
        { start: ten, end: eleven },
      ),
    ).toBe(true);
  });

  it("measures minutes", () => {
    expect(
      minutesBetween(
        new Date("2026-07-16T09:00:00Z"),
        new Date("2026-07-16T10:30:00Z"),
      ),
    ).toBe(90);
  });

  it("builds an inclusive date horizon", () => {
    const range = utcRangeBounds("2026-07-16", "2026-07-17");
    expect(range.start.toISOString()).toBe("2026-07-16T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-07-18T00:00:00.000Z");
  });

  it("reads local time-zone parts", () => {
    expect(
      localParts(new Date("2026-07-16T16:30:00Z"), "America/Los_Angeles"),
    ).toEqual({ date: "2026-07-16", minutes: 570, weekday: 4 });
  });

  it("falls back from an invalid time zone", () => {
    expect(safeTimeZone("not/a-zone")).toBe("UTC");
    expect(clockMinutes("14:45")).toBe(885);
  });
});
