"use client";

import { useState, useTransition, type FormEvent } from "react";
import { archiveHabit, createHabit, setHabitLog } from "./actions";

export type HabitGridRow = {
  id: string;
  name: string;
  color: string;
  targetPerWeek: number;
  completedDates: string[];
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
};

export function HabitGrid({ rows, dates }: { rows: HabitGridRow[]; dates: string[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const cadence = String(data.get("cadence"));
    const days = data.getAll("days").map(Number);
    startTransition(async () => {
      const result = await createHabit({
        name: String(data.get("name") ?? ""),
        cadence,
        days,
        targetPerWeek: Number(data.get("target")),
        color: String(data.get("color") ?? ""),
      });
      setError(result.error);
      if (!result.error) formElement.reset();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="min-w-max p-3">
          <div className="grid grid-cols-[10rem_repeat(30,1.5rem)] gap-1 text-center text-[10px] text-zinc-500">
            <span />
            {dates.map((date) => <span key={date}>{date.slice(8)}</span>)}
            {rows.map((habit) => {
              const completed = new Set(habit.completedDates);
              return (
                <div key={habit.id} className="contents">
                  <div className="flex items-center justify-between gap-2 pr-2 text-left text-sm text-zinc-900 dark:text-zinc-100">
                    <span className="truncate">{habit.name}</span>
                    <button
                      type="button"
                      onClick={() => startTransition(async () => setError((await archiveHabit({ id: habit.id })).error))}
                      className="text-xs text-zinc-400"
                    >
                      Archive
                    </button>
                  </div>
                  {dates.map((date) => {
                    const done = completed.has(date);
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={isPending}
                        aria-label={`${habit.name}, ${date}, ${done ? "done" : "not done"}`}
                        onClick={() => startTransition(async () => setError((await setHabitLog({ habitId: habit.id, date, done: !done })).error))}
                        className="size-5 rounded-full border"
                        style={{ backgroundColor: done ? habit.color : "transparent", borderColor: habit.color }}
                      />
                    );
                  })}
                  <div className="col-span-full mb-3 ml-40 text-xs text-zinc-500">
                    Current {habit.currentStreak} · Longest {habit.longestStreak} · {habit.completionRate}% of target
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <form onSubmit={add} className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800">
        <input name="name" required placeholder="Habit name" className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
        <select name="cadence" className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700">
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="custom">Specific days</option>
        </select>
        <label className="text-sm">Weekly target <input name="target" type="number" min={1} max={7} defaultValue={7} className="ml-2 w-16 rounded border bg-transparent px-2 py-1" /></label>
        <label className="text-sm">Color <input name="color" type="color" defaultValue="#0ea5e9" className="ml-2" /></label>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm text-zinc-500">Specific days</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, index) => (
              <label key={day}><input type="checkbox" name="days" value={index} className="mr-1" />{day}</label>
            ))}
          </div>
        </fieldset>
        <button disabled={isPending} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white sm:col-span-2 dark:bg-zinc-100 dark:text-zinc-900">Add habit</button>
        {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
      </form>
    </div>
  );
}
