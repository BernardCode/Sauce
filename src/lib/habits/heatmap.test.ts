import { describe, expect, it } from "vitest";
import { habitContributionLevel } from "./heatmap";

describe("habitContributionLevel", () => {
  it("keeps empty days unshaded", () => {
    expect(habitContributionLevel(0, 5)).toBe(0);
  });

  it("normalizes completed habits against the busiest day", () => {
    expect(habitContributionLevel(1, 4)).toBe(1);
    expect(habitContributionLevel(2, 4)).toBe(2);
    expect(habitContributionLevel(3, 4)).toBe(3);
    expect(habitContributionLevel(4, 4)).toBe(4);
  });

  it("caps the strongest shade", () => {
    expect(habitContributionLevel(6, 4)).toBe(4);
  });
});
