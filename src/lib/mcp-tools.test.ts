import { describe, expect, it } from "vitest";
import { defaultPlanningRange } from "./mcp-tools-core";

describe("MCP planning range", () => {
  it("defaults to today through seven days out", () => {
    expect(defaultPlanningRange(new Date("2026-07-16T23:45:00.000Z"))).toEqual({
      from_date: "2026-07-16",
      to_date: "2026-07-23",
    });
  });
});
