import { describe, expect, it } from "vitest";
import { isPostponedWork } from "./postponed-work";

const keywords = ["essay", "essays", "sat"];

describe("postponed work", () => {
  it("matches essay and SAT work by title or course", () => {
    expect(isPostponedWork({ title: "Draft Why-CS Essay" }, keywords)).toBe(true);
    expect(isPostponedWork({ title: "Practice", course: "Rice Essays" }, keywords)).toBe(true);
    expect(isPostponedWork({ title: "SAT Prep" }, keywords)).toBe(true);
  });

  it("does not confuse SAT with Saturday", () => {
    expect(isPostponedWork({ title: "Saturday volunteer shift" }, keywords)).toBe(false);
  });
});
