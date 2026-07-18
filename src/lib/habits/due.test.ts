import { describe, expect, it } from "vitest";
import { habitIsDue } from "./due";

describe("habit due dates", () => {
  it("includes every day for daily habits", () => {
    expect(habitIsDue("daily", [], 0)).toBe(true);
    expect(habitIsDue("daily", [], 6)).toBe(true);
  });

  it("keeps weekday habits off weekends", () => {
    expect(habitIsDue("weekdays", [], 1)).toBe(true);
    expect(habitIsDue("weekdays", [], 0)).toBe(false);
  });

  it("uses the selected days for custom habits", () => {
    expect(habitIsDue("custom", [2, 4], 2)).toBe(true);
    expect(habitIsDue("custom", [2, 4], 3)).toBe(false);
  });
});
