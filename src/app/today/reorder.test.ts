import { describe, expect, it } from "vitest";
import { applySavedOrder, reorderItemIds } from "./reorder";

describe("reorderItemIds", () => {
  it("moves an item before a target", () => {
    expect(reorderItemIds(["a", "b", "c"], "c", "a", "before")).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("moves an item after a target", () => {
    expect(reorderItemIds(["a", "b", "c"], "a", "b", "after")).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("leaves the order alone for unknown or identical items", () => {
    const itemIds = ["a", "b", "c"];
    expect(reorderItemIds(itemIds, "a", "a", "before")).toBe(itemIds);
    expect(reorderItemIds(itemIds, "missing", "a", "before")).toBe(itemIds);
  });
});

describe("applySavedOrder", () => {
  it("uses saved positions and appends newly visible items", () => {
    expect(applySavedOrder(["a", "b", "c"], ["b", "a"])).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("ignores stale and duplicate saved ids", () => {
    expect(applySavedOrder(["a", "b"], ["old", "b", "b"])).toEqual([
      "b",
      "a",
    ]);
  });
});
