import { describe, expect, it } from "vitest";
import { classifyCourse } from "./course";

describe("quick-add course classification", () => {
  it.each([
    ["AP Gov federalism FRQ", "AP Gov"],
    ["AP Lit poetry analysis", "AP Lit"],
    ["Taylor series problem set", "AP Calc BC"],
    ["momentum lab", "AP Physics C"],
    ["glaze the coil pot", "Ceramics"],
    ["PE mile run", "PE"],
    ["gov FRQ", "AP Gov"],
    ["lit close reading", "AP Lit"],
    ["calc homework", "AP Calc BC"],
  ])("classifies %s as %s", (title, course) => {
    expect(classifyCourse(title)).toBe(course);
  });

  it("leaves an ambiguous title unclassified", () => {
    expect(classifyCourse("finish unit 3 worksheet")).toBeNull();
    expect(classifyCourse("calculus momentum review")).toBeNull();
  });
});
