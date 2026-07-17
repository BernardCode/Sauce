export type HabitStats = {
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function calculateHabitStats(
  completedDates: string[],
  today: Date,
  targetPerWeek: number,
): HabitStats {
  const completed = new Set(completedDates);
  const sorted = [...completed].sort();
  let longestStreak = 0;
  let running = 0;
  let previous: Date | null = null;
  for (const key of sorted) {
    const current = new Date(`${key}T12:00:00.000Z`);
    running = previous && current.getTime() - previous.getTime() === 86_400_000
      ? running + 1
      : 1;
    longestStreak = Math.max(longestStreak, running);
    previous = current;
  }

  let currentStreak = 0;
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12));
  while (completed.has(dateKey(cursor))) {
    currentStreak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const thirtyDaysAgo = new Date(cursor);
  thirtyDaysAgo.setTime(today.getTime() - 29 * 86_400_000);
  const recentCount = sorted.filter(
    (key) => new Date(`${key}T12:00:00.000Z`) >= thirtyDaysAgo,
  ).length;
  const expected = Math.max(1, (targetPerWeek * 30) / 7);
  return {
    currentStreak,
    longestStreak,
    completionRate: Math.min(100, Math.round((recentCount / expected) * 100)),
  };
}
