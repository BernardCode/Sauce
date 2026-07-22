import { describe, expect, it } from "vitest";
import { readItemContext, writeItemContext } from "./item-context";

describe("planner item context", () => {
  it("round trips a description and source URL", () => {
    const stored = writeItemContext(
      "Revise the opening with counselor feedback.",
      "https://docs.google.com/document/d/example",
    );
    expect(stored).toBe(
      "Revise the opening with counselor feedback.\n\nSource: https://docs.google.com/document/d/example",
    );
    expect(readItemContext(stored)).toEqual({
      description: "Revise the opening with counselor feedback.",
      sourceUrl: "https://docs.google.com/document/d/example",
    });
  });

  it("round trips a source without a description", () => {
    const stored = writeItemContext(null, "https://example.com/assignment");
    expect(readItemContext(stored)).toEqual({
      description: null,
      sourceUrl: "https://example.com/assignment",
    });
  });

  it("leaves ordinary description text unchanged", () => {
    expect(readItemContext("Use the source: textbook chapter 4")).toEqual({
      description: "Use the source: textbook chapter 4",
      sourceUrl: null,
    });
  });
});
