import { describe, expect, it } from "vitest";
import { secretsMatch } from "./mcp-auth-core";

describe("MCP secret comparison", () => {
  it("accepts an exact match", () => {
    expect(secretsMatch("a".repeat(32), "a".repeat(32))).toBe(true);
  });

  it("rejects different values and lengths", () => {
    expect(secretsMatch("a".repeat(32), "b".repeat(32))).toBe(false);
    expect(secretsMatch("short", "a".repeat(32))).toBe(false);
  });
});
