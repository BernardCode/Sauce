import { endOfLocalDay, localParts } from "../../lib/planner/time";

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function previousDayRollover(now: Date, timeZone: string) {
  const today = localParts(now, timeZone).date;
  return {
    today,
    yesterday: shiftDate(today, -1),
    dueAt: endOfLocalDay(today, timeZone),
  };
}
