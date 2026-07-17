export function habitIsDue(
  cadence: string,
  days: number[],
  weekday: number,
): boolean {
  if (cadence === "daily") return true;
  if (cadence === "weekdays") return weekday >= 1 && weekday <= 5;
  return cadence === "custom" && days.includes(weekday);
}
