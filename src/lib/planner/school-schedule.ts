import type { WorkingHours } from "./schemas";

const SCHOOL_WINDOWS: WorkingHours["blockedWindows"] = [
  { days: [1, 2, 4], start: "00:00", end: "16:00" },
  { days: [3, 5], start: "00:00", end: "15:15" },
];

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
