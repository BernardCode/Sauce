import { describe, expect, it } from "vitest";
import {
  mergePlannerPreferences,
  readTodayTaskOrder,
} from "./preferences";

const firstId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const secondId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

describe("planner preference storage", () => {
  it("reads a valid Today task order", () => {
    expect(
      readTodayTaskOrder({ text: "Work in short blocks", todayTaskOrder: [firstId, secondId] }),
    ).toEqual([firstId, secondId]);
  });

  it("rejects malformed task orders", () => {
    expect(readTodayTaskOrder({ todayTaskOrder: ["not-a-uuid"] })).toEqual([]);
  });

  it("merges updates without discarding other preferences", () => {
    expect(
      mergePlannerPreferences(
        { text: "Keep this", todayTaskOrder: [firstId] },
        { text: "Updated" },
      ),
    ).toEqual({ text: "Updated", todayTaskOrder: [firstId] });
  });
});
