"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateCourseDefault } from "./actions";

type CourseDefault = {
  course: string;
  defaultMinutes: number;
  sampleCount: number;
};

export function CourseDefaults({ defaults }: { defaults: CourseDefault[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    startTransition(async () => {
      const result = await updateCourseDefault({
        course: String(form.get("course") ?? ""),
        defaultMinutes: Number(form.get("minutes")),
      });
      setError(result.error);
      if (!result.error && formElement.querySelector('[placeholder="Course"]')) {
        formElement.reset();
      }
    });
  }

  return (
    <section>
      <h2 className="font-medium">Course defaults</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Work sessions update these running estimates automatically.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {defaults.map((entry) => (
          <form
            key={entry.course}
            onSubmit={save}
            className="motion-course-row grid grid-cols-[1fr_7rem_auto] items-center gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <input type="hidden" name="course" value={entry.course} />
            <span className="text-sm">{entry.course}</span>
            <input
              name="minutes"
              type="number"
              min={1}
              max={10_000}
              defaultValue={entry.defaultMinutes}
              aria-label={`Default minutes for ${entry.course}`}
              className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
            />
            <button disabled={isPending} className="text-sm text-zinc-600 dark:text-zinc-300">
              Save
            </button>
            <span className="col-span-3 text-xs text-zinc-500">
              {entry.sampleCount} work samples
            </span>
          </form>
        ))}
        <form onSubmit={save} className="grid grid-cols-[1fr_7rem_auto] gap-2">
          <input
            name="course"
            required
            placeholder="Course"
            className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
          />
          <input
            name="minutes"
            required
            type="number"
            min={1}
            max={10_000}
            placeholder="Minutes"
            aria-label="Default minutes"
            className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
          />
          <button
            disabled={isPending}
            className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add
          </button>
        </form>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
