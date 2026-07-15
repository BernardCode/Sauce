export type DueTone = "overdue" | "soon" | "normal";

export type DueLabel = {
  label: string;
  tone: DueTone;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// "11:59pm", or "5pm" when the minutes are zero, to keep labels short.
function clockTime(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours24 < 12 ? "am" : "pm";
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return minutes === 0
    ? `${hours}${suffix}`
    : `${hours}:${String(minutes).padStart(2, "0")}${suffix}`;
}

// Floored units read conservatively: "due in 3h" until the fourth hour is
// really gone, "overdue by 1d" until a second full day has passed.
function coarseAmount(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / MINUTE))}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
  return `${Math.floor(ms / DAY)}d`;
}

export function formatDue(due: Date, now: Date): DueLabel {
  const diff = due.getTime() - now.getTime();

  if (diff < 0) {
    return { label: `overdue by ${coarseAmount(-diff)}`, tone: "overdue" };
  }

  const tone: DueTone = diff < DAY ? "soon" : "normal";

  // Inside 12 hours a countdown beats a clock time.
  if (diff < 12 * HOUR) {
    return { label: `due in ${coarseAmount(diff)}`, tone };
  }

  if (isSameLocalDay(due, now)) {
    return { label: `due today ${clockTime(due)}`, tone };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameLocalDay(due, tomorrow)) {
    return { label: `due tomorrow ${clockTime(due)}`, tone };
  }

  if (diff < 7 * DAY) {
    const weekday = due.toLocaleDateString(undefined, { weekday: "short" });
    return { label: `due ${weekday} ${clockTime(due)}`, tone };
  }

  const date = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { label: `due ${date}`, tone };
}
