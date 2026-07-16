import { describe, expect, it } from "vitest";
import { isProjectAtRisk } from "./risk";

describe("project risk", () => {
  const base = {
    nowMs: 100,
    deadlineMs: 1_000,
    remainingMinutes: 120,
    availableMinutes: 180,
    scheduledEndTimesMs: [] as number[],
  };

  it("flags work that cannot fit or ends after the deadline", () => {
    expect(isProjectAtRisk({ ...base, remainingMinutes: 200 })).toBe(true);
    expect(isProjectAtRisk({ ...base, scheduledEndTimesMs: [1_001] })).toBe(true);
  });

  it("leaves feasible and completed projects alone", () => {
    expect(isProjectAtRisk(base)).toBe(false);
    expect(isProjectAtRisk({ ...base, remainingMinutes: 0, deadlineMs: 50 })).toBe(false);
  });
});
