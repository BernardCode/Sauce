import { localParts } from "../../lib/planner/time";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function endOfLocalDay(date: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  let candidate = targetWallTime;

  // Converge from wall-clock time to UTC without assuming a fixed offset.
  // This keeps rollover correct through daylight-saving changes.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const representedWallTime = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      999,
    );
    candidate += targetWallTime - representedWallTime;
  }

  return new Date(candidate).toISOString();
}

export function previousDayRollover(now: Date, timeZone: string) {
  const today = localParts(now, timeZone).date;
  return {
    today,
    yesterday: shiftDate(today, -1),
    dueAt: endOfLocalDay(today, timeZone),
  };
}
