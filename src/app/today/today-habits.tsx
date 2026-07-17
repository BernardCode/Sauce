"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { setHabitLog } from "@/app/habits/actions";

type TodayHabit = {
  id: string;
  name: string;
  color: string;
  done: boolean;
};

export function TodayHabits({ habits, date }: { habits: TodayHabit[]; date: string }) {
  const [error, setError] = useState<string | null>(null);
  const [doneById, setDoneById] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(habits.map((habit) => [habit.id, habit.done])),
  );
  const [isPending, startTransition] = useTransition();
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
      <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Habits</h2><CheckCircle2 size={17} className="text-emerald-500" /></div>
      {habits.length ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {habits.map((habit) => (
            <button
              key={habit.id}
              type="button"
              disabled={isPending}
              title={habit.name}
              aria-label={`${habit.name}, ${doneById[habit.id] ? "done" : "not done"}`}
              onClick={() => {
                const previous = doneById[habit.id];
                const next = !previous;
                setDoneById((current) => ({ ...current, [habit.id]: next }));
                startTransition(async () => {
                  const result = await setHabitLog({ habitId: habit.id, date, done: next });
                  setError(result.error);
                  if (result.error) setDoneById((current) => ({ ...current, [habit.id]: previous }));
                });
              }}
              className="group flex flex-col items-center gap-1.5 text-xs text-[var(--muted)] disabled:opacity-50"
            >
              <span
                className="size-8 rounded-full border-2 shadow-sm group-hover:scale-110"
                style={{ borderColor: habit.color, backgroundColor: doneById[habit.id] ? habit.color : "transparent" }}
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
