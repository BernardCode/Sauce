"use client";

import { useState, useTransition, type FormEvent } from "react";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import { addItem } from "./actions";

export function QuickAdd({
  onPendingChange,
}: {
  onPendingChange?: (title: string | null) => void;
}) {
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
    onPendingChange?.(parsed.title);

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
      onPendingChange?.(null);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="motion-quick-add today-task-entry">
      <span className="today-task-entry-plus" aria-hidden="true">+</span>
      <div className="min-w-0 flex-1">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="New task"
          aria-label="Add a task"
          className="today-task-entry-input"
        />
        {pendingTitle ? <span className="today-task-entry-status">Adding {pendingTitle}...</span> : null}
      </div>
      <button
        type="submit"
        disabled={isPending || value.trim() === ""}
        aria-label="Add task"
        className="today-task-entry-button"
      >
        Add
      </button>
      {error ? (
        <p className="today-task-entry-error">{error}</p>
      ) : null}
    </form>
  );
}
