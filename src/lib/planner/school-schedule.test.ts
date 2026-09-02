import { describe, expect, it } from "vitest";
import {
  ACADEMIC_PLANNING_RULES,
  CLASS_MEETING_SCHEDULE,
  academicWorkTreatment,
  classMeetingDays,
  schoolDayRailStartHour,
  schoolDismissalMinutes,
  withSchoolDayWindows,
} from "./school-schedule";

describe("school schedule", () => {
  it("describes which classes meet on each alternating school day", () => {
    expect(CLASS_MEETING_SCHEDULE).toEqual([
      {
        courses: ["AP Gov/Econ", "AP Calc BC", "AP Lit"],
        weekdays: ["Monday", "Tuesday", "Thursday"],
      },
      {
        courses: ["PE", "Ceramics", "AP Physics C"],
        weekdays: ["Monday", "Wednesday", "Friday"],
      },
    ]);
  });

  it("maps a task to its class meeting days", () => {
    expect(classMeetingDays("AP Calc BC Period 2", "Problem set")).toEqual([
      "Monday",
      "Tuesday",
      "Thursday",
    ]);
    expect(classMeetingDays("Schoology", "Momentum lab")).toEqual([
      "Monday",
      "Wednesday",
      "Friday",
    ]);
    expect(classMeetingDays("Schoology", "General announcement")).toBeNull();
  });

  it("keeps Physics quizzes in class unless the title asks for preparation", () => {
    expect(ACADEMIC_PLANNING_RULES[0]).toMatchObject({
      course: "AP Physics C",
    });
    expect(academicWorkTreatment("AP Physics C", "Quiz 2")).toBe(
      "in_class_assessment",
    );
    expect(academicWorkTreatment("AP Physics C", "Study for Quiz 2")).toBe(
      "schedulable_work",
    );
    expect(academicWorkTreatment("AP Physics C", "Quiz corrections")).toBe(
      "schedulable_work",
    );
    expect(academicWorkTreatment("AP Calc BC", "Quiz 2")).toBe(
      "schedulable_work",
    );
  });

  it("uses 4pm dismissal on Monday, Tuesday, and Thursday", () => {
    expect([1, 2, 4].map(schoolDismissalMinutes)).toEqual([960, 960, 960]);
  });

  it("uses 3:15pm dismissal on Wednesday and Friday", () => {
    expect([3, 5].map(schoolDismissalMinutes)).toEqual([915, 915]);
    expect(schoolDayRailStartHour(3, 7)).toBe(15);
  });

  it("keeps the configured wake hour on weekends", () => {
    expect(schoolDayRailStartHour(6, 8)).toBe(8);
  });

  it("adds school windows without removing personal blocked time", () => {
    expect(
      withSchoolDayWindows({
        wake: 7,
        sleep: 23,
        blockedWindows: [{ days: [1], start: "18:00", end: "19:00" }],
      }).blockedWindows,
    ).toEqual([
      { days: [1], start: "18:00", end: "19:00" },
      { days: [1, 2, 4], start: "00:00", end: "16:00" },
      { days: [3, 5], start: "00:00", end: "15:15" },
    ]);
  });
});
