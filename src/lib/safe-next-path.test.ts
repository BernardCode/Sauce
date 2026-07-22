import { describe, expect, it } from "vitest";
import { parseSafeNextPath } from "./safe-next-path";

describe("safe return paths", () => {
  it("accepts a local path with a query", () => {
    expect(
      parseSafeNextPath("/oauth/consent?authorization_id=request-123"),
    ).toBe("/oauth/consent?authorization_id=request-123");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(parseSafeNextPath("https://example.com/steal")).toBeNull();
    expect(parseSafeNextPath("//example.com/steal")).toBeNull();
    expect(parseSafeNextPath("/\\example.com/steal")).toBeNull();
  });
});
