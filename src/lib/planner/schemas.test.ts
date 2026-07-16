import { describe, expect, it } from "vitest";
import {
  applyPlanInputSchema,
  blockProposalSchema,
  workingHoursSchema,
} from "./schemas";

describe("planner schemas", () => {
  const validBlock = {
    item_id: "00000000-0000-4000-8000-000000000001",
    title: "Write lab conclusion",
    start_at: "2026-07-16T16:00:00.000Z",
    end_at: "2026-07-16T17:00:00.000Z",
    reason: "The lab is due tomorrow afternoon.",
  };

  it("accepts a valid block proposal", () => {
    expect(blockProposalSchema.safeParse(validBlock).success).toBe(true);
  });

  it("rejects an inverted block", () => {
    expect(
      blockProposalSchema.safeParse({
        ...validBlock,
        end_at: "2026-07-16T15:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejects a block longer than three hours", () => {
    expect(
      blockProposalSchema.safeParse({
        ...validBlock,
        end_at: "2026-07-16T20:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejects a reversed planning horizon", () => {
    expect(
      applyPlanInputSchema.safeParse({
        from_date: "2026-07-17",
        to_date: "2026-07-16",
        blocks: [],
      }).success,
    ).toBe(false);
  });

  it("rejects inverted working hours and blocked windows", () => {
    expect(workingHoursSchema.safeParse({ wake: 22, sleep: 7 }).success).toBe(
      false,
    );
    expect(
      workingHoursSchema.safeParse({
        wake: 7,
        sleep: 23,
        blockedWindows: [{ start: "15:00", end: "08:00" }],
      }).success,
    ).toBe(false);
  });
});
