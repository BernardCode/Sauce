"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Archive, Plus } from "lucide-react";
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
  const [completedByHabit, setCompletedByHabit] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(rows.map((habit) => [habit.id, habit.completedDates])),
  );
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
    <div className="motion-habit-grid flex flex-col gap-6">
      <div className="motion-habit-table overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)]">
        <div className="min-w-max p-4">
          <div className="grid grid-cols-[11rem_repeat(30,1.65rem)] gap-1.5 text-center text-[10px] text-[var(--muted)]">
            <span />
            {dates.map((date) => <span key={date}>{date.slice(8)}</span>)}
            {rows.map((habit) => {
              const completed = new Set(completedByHabit[habit.id] ?? []);
              return (
                <div key={habit.id} className="contents">
                  <div className="motion-habit-row flex items-center justify-between gap-2 pr-2 text-left text-sm text-zinc-900 dark:text-zinc-100">
                    <span className="truncate font-semibold">{habit.name}</span>
                    <button
                      type="button"
                      onClick={() => startTransition(async () => setError((await archiveHabit({ id: habit.id })).error))}
                      aria-label={`Archive ${habit.name}`}
                      className="motion-archive rounded-lg p-1.5 text-zinc-400 hover:bg-[var(--danger-soft)] hover:text-rose-500"
                    >
                      <Archive size={14} />
                    </button>
                  </div>
                  {dates.map((date) => {
                    const done = completed.has(date);
                    return (
                      <button
                        key={date}
                        type="button"
                        aria-label={`${habit.name}, ${date}, ${done ? "done" : "not done"}`}
                        data-done={done}
                        onClick={() => {
                          const nextDone = !done;
                          setCompletedByHabit((current) => {
                            const values = new Set(current[habit.id] ?? []);
                            if (nextDone) values.add(date); else values.delete(date);
                            return { ...current, [habit.id]: [...values] };
                          });
                          startTransition(async () => {
                            const result = await setHabitLog({ habitId: habit.id, date, done: nextDone });
                            setError(result.error);
                            if (result.error) {
                              setCompletedByHabit((current) => {
                                const values = new Set(current[habit.id] ?? []);
                                if (done) values.add(date); else values.delete(date);
                                return { ...current, [habit.id]: [...values] };
                              });
                            }
                          });
                        }}
                        className="motion-habit-cell size-6 rounded-lg border shadow-sm hover:scale-110"
                        style={{ backgroundColor: done ? habit.color : "transparent", borderColor: habit.color }}
                      />
                    );
                  })}
                  <div className="motion-streaks col-span-full mb-4 ml-44 flex gap-4 text-xs text-[var(--muted)]">
                    <span><strong className="text-[var(--foreground)]">{habit.currentStreak}</strong> current streak</span><span><strong className="text-[var(--foreground)]">{habit.longestStreak}</strong> longest</span><span><strong className="text-[var(--foreground)]">{habit.completionRate}%</strong> of target</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <form onSubmit={add} className="grid gap-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-subtle)] p-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><h2 className="font-semibold">Add a habit</h2><p className="mt-1 text-xs text-[var(--muted)]">Keep it specific and easy to check off.</p></div>
        <input name="name" required placeholder="Habit name" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" />
        <select name="cadence" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]">
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
        <button disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-deep)] sm:col-span-2"><Plus size={16} /> Add habit</button>
        {error ? <p className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
      </form>
    </div>
  );
}
