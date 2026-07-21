export type HabitContributionLevel = 0 | 1 | 2 | 3 | 4;

export function habitContributionLevel(
  completed: number,
  busiestDay: number,
): HabitContributionLevel {
  if (completed <= 0 || busiestDay <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((completed / busiestDay) * 4))) as HabitContributionLevel;
}
