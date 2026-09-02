import type { WorkingHours } from "./schemas";
import {
  classifyCourse,
  type StudentCourse,
} from "../quick-add/course";

const SCHOOL_WINDOWS: WorkingHours["blockedWindows"] = [
  { days: [1, 2, 4], start: "00:00", end: "16:00" },
  { days: [3, 5], start: "00:00", end: "15:15" },
];

export const CLASS_MEETING_SCHEDULE = [
  {
    courses: ["AP Gov/Econ", "AP Calc BC", "AP Lit"],
    weekdays: ["Monday", "Tuesday", "Thursday"],
  },
  {
    courses: ["PE", "Ceramics", "AP Physics C"],
    weekdays: ["Monday", "Wednesday", "Friday"],
  },
] as const;

const meetingDaysByCourse: Record<StudentCourse, readonly string[]> = {
  "AP Gov": CLASS_MEETING_SCHEDULE[0].weekdays,
  "AP Lit": CLASS_MEETING_SCHEDULE[0].weekdays,
  "AP Calc BC": CLASS_MEETING_SCHEDULE[0].weekdays,
  "AP Physics C": CLASS_MEETING_SCHEDULE[1].weekdays,
  Ceramics: CLASS_MEETING_SCHEDULE[1].weekdays,
  PE: CLASS_MEETING_SCHEDULE[1].weekdays,
};

export function classMeetingDays(
  course: string | null,
  title: string,
): readonly string[] | null {
  const identifiedCourse =
    classifyCourse(course ?? "") ?? classifyCourse(title);
  return identifiedCourse ? meetingDaysByCourse[identifiedCourse] : null;
}

export function schoolDismissalMinutes(weekday: number): number | null {
  if ([1, 2, 4].includes(weekday)) return 16 * 60;
  if ([3, 5].includes(weekday)) return 15 * 60 + 15;
  return null;
}

export function schoolDayRailStartHour(
  weekday: number,
  fallbackHour: number,
): number {
  const dismissal = schoolDismissalMinutes(weekday);
  return dismissal === null ? fallbackHour : Math.floor(dismissal / 60);
}

export function withSchoolDayWindows(hours: WorkingHours): WorkingHours {
  return {
    ...hours,
    blockedWindows: [...hours.blockedWindows, ...SCHOOL_WINDOWS],
  };
}
