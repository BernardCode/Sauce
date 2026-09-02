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
    ["macroeconomics fiscal policy", "AP Gov"],
    ["lit close reading", "AP Lit"],
    ["The Namesake analysis", "AP Lit"],
    ["calc homework", "AP Calc BC"],
    ["AP English Literature and Composition Period 4", "AP Lit"],
    ["AP US Government and Politics P1", "AP Gov"],
    ["AP Physics C: Mechanics Period 6", "AP Physics C"],
  ])("classifies %s as %s", (title, course) => {
    expect(classifyCourse(title)).toBe(course);
  });

  it("leaves an ambiguous title unclassified", () => {
    expect(classifyCourse("finish unit 3 worksheet")).toBeNull();
    expect(classifyCourse("calculus momentum review")).toBeNull();
  });
});
