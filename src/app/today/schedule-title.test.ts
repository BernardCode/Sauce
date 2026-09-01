import { describe, expect, it } from "vitest";
import { formatScheduleTitle } from "./schedule-title";

describe("schedule title", () => {
  it("removes filler verbs and abbreviates numbered units", () => {
    expect(formatScheduleTitle("Complete AP Government Unit 1 progress check"))
      .toBe("AP Government U1 progress check");
    expect(formatScheduleTitle("Finish the Unit 2B review"))
      .toBe("U2B review");
  });

  it("keeps specific action words and normalizes spacing", () => {
    expect(formatScheduleTitle("  Draft   chapter analysis  "))
      .toBe("Draft chapter analysis");
  });
});
