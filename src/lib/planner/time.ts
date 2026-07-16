export type TimeInterval = {
  start: Date;
  end: Date;
};

export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && a.end > b.start;
}

export function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60_000;
}

export function utcRangeBounds(fromDate: string, toDate: string) {
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function partsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

const weekdayNumbers: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function localParts(date: Date, timeZone: string) {
  const parts = partsInTimeZone(date, timeZone);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: weekdayNumbers[parts.weekday] ?? 0,
  };
}

export function safeTimeZone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}

export function clockMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
