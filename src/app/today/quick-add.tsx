"use client";

import { useState, useTransition, type FormEvent } from "react";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import { addItem } from "./actions";

export function QuickAdd() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const trimmed = value.trim();
    if (trimmed === "") return;

    // Parsing happens here, not in the action, because only the browser
    // knows the user's timezone.
    const parsed = parseQuickAdd(trimmed);

    startTransition(async () => {
      const result = await addItem({
        title: parsed.title,
        dueAtIso: parsed.dueAt ? parsed.dueAt.toISOString() : null,
        estMinutes: parsed.estMinutes,
        isProject: parsed.isProject === true,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setValue("");
        setError(null);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Add a task, or prefix * for a project"
        aria-label="Add a task"
        className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:focus:border-zinc-600"
      />
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </form>
  );
}
