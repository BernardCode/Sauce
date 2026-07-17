"use client";

import { useState, useTransition } from "react";
import { setHabitLog } from "@/app/habits/actions";

type TodayHabit = {
  id: string;
  name: string;
  color: string;
  done: boolean;
};

export function TodayHabits({ habits, date }: { habits: TodayHabit[]; date: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-medium">Habits</h2>
      {habits.length ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {habits.map((habit) => (
            <button
              key={habit.id}
              type="button"
              disabled={isPending}
              title={habit.name}
              aria-label={`${habit.name}, ${habit.done ? "done" : "not done"}`}
              onClick={() => startTransition(async () => setError((await setHabitLog({ habitId: habit.id, date, done: !habit.done })).error))}
              className="flex flex-col items-center gap-1 text-xs text-zinc-500 disabled:opacity-50"
            >
              <span
                className="size-7 rounded-full border-2"
                style={{ borderColor: habit.color, backgroundColor: habit.done ? habit.color : "transparent" }}
              />
              <span className="max-w-16 truncate">{habit.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">No habits due today.</p>
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
