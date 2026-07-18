import { habitIsDue } from "./due";

export type HabitScheduleInput = {
  id: string;
  name: string;
  cadence: string;
  days: number[];
  scheduledTime: string | null;
};

export type HabitScheduleEntry = {
  id: string;
  habitId: string;
  name: string;
  date: string;
  scheduledTime: string;
  done: boolean;
};

export function buildHabitSchedule(
  dates: string[],
  habits: HabitScheduleInput[],
  completedDates: Set<string>,
): HabitScheduleEntry[] {
  return dates.flatMap((date) => {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    return habits.flatMap((habit) => {
      if (!habit.scheduledTime || !habitIsDue(habit.cadence, habit.days, weekday)) {
        return [];
      }
      return [{
        id: `${habit.id}:${date}`,
        habitId: habit.id,
        name: habit.name,
        date,
        scheduledTime: habit.scheduledTime,
        done: completedDates.has(`${habit.id}:${date}`),
      }];
    });
  });
}
