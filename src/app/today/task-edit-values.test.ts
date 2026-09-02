import { describe, expect, it } from "vitest";
import { dateInputValue, endOfDate } from "./task-edit-values";

describe("task edit date values", () => {
  it("round trips a local due date through the date input", () => {
    const dueAt = endOfDate("2026-09-04");

    expect(dueAt).not.toBeNull();
    expect(dateInputValue(dueAt)).toBe("2026-09-04");
  });

  it("supports clearing a due date", () => {
    expect(endOfDate("")).toBeNull();
    expect(dateInputValue(null)).toBe("");
  });
});
