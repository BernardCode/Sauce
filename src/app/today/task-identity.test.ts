import { describe, expect, it } from "vitest";
import { identifyTask } from "./task-identity";

describe("Today task identity", () => {
  it.each([
    ["bc homework", null, "📐", "AP Calc BC"],
    ["Finish BC worksheet", "Schoology", "📐", "AP Calc BC"],
    ["Practice test", "BC", "📐", "AP Calc BC"],
    ["Read The Namesake", "Schoology", "📚", "AP Lit"],
    ["Hw#7: Finish 5.1 ivory packet", "Math", "📐", "AP Calc BC"],
    ["Federalism progress check", "Schoology", "🏛️", "AP Gov/Econ"],
    ["Momentum lab", "Schoology", "⚛️", "AP Physics C"],
    ["Glaze coil pot", "Schoology", "🏺", "Ceramics"],
    ["Mile run", "PE", "🏃", "PE"],
  ])("classifies %s", (title, course, emoji, label) => {
    expect(identifyTask(title, course)).toEqual({ emoji, label });
  });

  it("uses a workstream identity instead of exposing a feed source", () => {
    expect(identifyTask("AP Classroom sign up", "Schoology")).toEqual({
      emoji: "",
      label: "",
    });
    expect(
      identifyTask("Confirm district SAT registration", "Schoology"),
    ).toEqual({
      emoji: "🎯",
      label: "SAT",
    });
  });
});
