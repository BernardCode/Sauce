"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import { addItem } from "./actions";

export function QuickAdd() {
  const [value, setValue] = useState("");
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
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
    setValue("");
    setPendingTitle(parsed.title);

    startTransition(async () => {
      const result = await addItem({
        title: parsed.title,
        dueAtIso: parsed.dueAt ? parsed.dueAt.toISOString() : null,
        estMinutes: parsed.estMinutes,
        isProject: parsed.isProject === true,
      });
      if (result.error) {
        setError(result.error);
        setValue(trimmed);
      } else {
        setError(null);
      }
      setPendingTitle(null);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="motion-quick-add flex flex-col gap-2">
      <div className="motion-input-shell flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-1.5 shadow-sm focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-[var(--primary-soft)]">
        <Sparkles size={17} className="motion-add-sparkle ml-2 shrink-0 text-[var(--primary)]" />
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Add a task, for example: chemistry notes fri 45m"
          aria-label="Add a task"
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-zinc-400"
        />
        <button
          type="submit"
          disabled={isPending || value.trim() === ""}
          aria-label="Add task"
          className="motion-add-button grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-white shadow-sm hover:-translate-y-0.5 hover:bg-[var(--primary-deep)] disabled:translate-y-0 disabled:opacity-40"
        >
          <ArrowUp size={17} strokeWidth={2.5} />
        </button>
      </div>
      <p className="px-1 text-[11px] text-[var(--muted)]">Use natural dates and times. Prefix with * to create a project.</p>
      {pendingTitle ? <p className="motion-pending-add px-1 text-xs font-medium text-[var(--primary)]">Adding {pendingTitle}...</p> : null}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </form>
  );
}
