import { describe, expect, it } from "vitest";
import { previousDayRollover } from "./rollover";

describe("previousDayRollover", () => {
  it("moves a summer Los Angeles commitment to the end of today", () => {
    expect(
      previousDayRollover(
        new Date("2026-07-26T16:00:00.000Z"),
        "America/Los_Angeles",
      ),
    ).toEqual({
      today: "2026-07-26",
      yesterday: "2026-07-25",
      dueAt: "2026-07-27T06:59:59.999Z",
    });
  });

  it("handles the previous day across a year boundary", () => {
    expect(
      previousDayRollover(new Date("2027-01-01T12:00:00.000Z"), "UTC"),
    ).toEqual({
      today: "2027-01-01",
      yesterday: "2026-12-31",
      dueAt: "2027-01-01T23:59:59.999Z",
    });
  });
});
