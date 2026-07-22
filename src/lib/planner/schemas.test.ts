import { describe, expect, it } from "vitest";
import {
  addItemInputSchema,
  applyPlanInputSchema,
  applyPlanServiceInputSchema,
  blockProposalSchema,
  createNoteInputSchema,
  decomposeProjectInputSchema,
  decomposeProjectServiceInputSchema,
  itemLifecycleInputSchema,
  projectStepSchema,
  updateItemInputSchema,
  updateNoteInputSchema,
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

  it("advertises and validates complete nested plan blocks", () => {
    const malformedPlan = {
      from_date: "2026-07-22",
      to_date: "2026-07-29",
      blocks: [{}],
    };
    expect(applyPlanInputSchema.safeParse(malformedPlan).success).toBe(false);
    expect(applyPlanServiceInputSchema.safeParse(malformedPlan).success).toBe(
      true,
    );

    const malformedProject = { project_id: validBlock.item_id, steps: [{}] };
    expect(
      decomposeProjectInputSchema.safeParse(malformedProject).success,
    ).toBe(false);
    expect(
      decomposeProjectServiceInputSchema.safeParse(malformedProject).success,
    ).toBe(true);
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

  it("validates project steps", () => {
    expect(
      projectStepSchema.safeParse({
        title: "Draft the introduction",
        est_minutes: 45,
        step_order: 0,
        suggested_due: "2026-07-20T23:59:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      projectStepSchema.safeParse({
        title: "",
        est_minutes: 0,
        step_order: -1,
        suggested_due: "later",
      }).success,
    ).toBe(false);
  });

  it("accepts task context and only permits web source links", () => {
    expect(
      addItemInputSchema.safeParse({
        title: "Draft Common App essay",
        description: "Revise the opening using the counselor feedback.",
        source_url: "https://docs.google.com/document/d/example",
      }).success,
    ).toBe(true);
    expect(
      addItemInputSchema.safeParse({
        title: "Unsafe source",
        source_url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("requires update tools to change at least one field", () => {
    const itemId = "00000000-0000-4000-8000-000000000001";
    expect(
      updateItemInputSchema.safeParse({
        item_id: itemId,
        description: "Bring the latest transcript.",
      }).success,
    ).toBe(true);
    expect(updateItemInputSchema.safeParse({ item_id: itemId }).success).toBe(
      false,
    );

    expect(
      updateNoteInputSchema.safeParse({
        note_id: itemId,
        body: "Updated details",
      }).success,
    ).toBe(true);
    expect(updateNoteInputSchema.safeParse({ note_id: itemId }).success).toBe(
      false,
    );
  });

  it("requires a real Sauce item id for lifecycle changes", () => {
    expect(
      itemLifecycleInputSchema.safeParse({
        item_id: "00000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(true);
    expect(
      itemLifecycleInputSchema.safeParse({ item_id: "FBLA DM" }).success,
    ).toBe(false);
  });

  it("validates note size and defaults", () => {
    expect(
      createNoteInputSchema.parse({ title: "College essay research" }),
    ).toEqual({
      title: "College essay research",
      body: "",
      pinned: false,
    });
    expect(
      createNoteInputSchema.safeParse({ title: "", body: "Details" }).success,
    ).toBe(false);
  });
});
