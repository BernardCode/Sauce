"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { restoreCompletedItem } from "./actions";

type CompletedItem = {
  id: string;
  title: string;
  course: string | null;
  completedAt: string;
};

type Props = {
  items: CompletedItem[];
};

function completedTimeLabel(value: string): string {
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function RecentCompletions({ items }: Props) {
  const [visibleItems, setVisibleItems] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function restore(item: CompletedItem) {
    setError(null);
    setPendingId(item.id);
    startTransition(async () => {
      const result = await restoreCompletedItem({ id: item.id });
      if (result.error) {
        setError(result.error);
      } else {
        setVisibleItems((current) =>
          current.filter((entry) => entry.id !== item.id),
        );
      }
      setPendingId(null);
    });
  }

  return (
    <section className="workspace-card mt-5">
      <div className="flex items-center gap-2">
        <RotateCcw size={18} className="text-[var(--primary)]" />
        <h2 className="font-semibold">Recently completed</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Restore anything that was checked off by mistake.
      </p>
      {error ? (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-2">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            data-item-id={item.id}
            data-completed-at={item.completedAt}
            className="flex items-center gap-3 rounded-xl bg-[var(--surface-subtle)] p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-[var(--muted)]">
                {item.course ?? "General"}, completed {completedTimeLabel(item.completedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => restore(item)}
              disabled={isPending}
              aria-label={`Restore "${item.title}"`}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-deep)] transition hover:bg-[var(--primary-soft)] disabled:opacity-50"
            >
              {pendingId === item.id ? "Restoring" : "Restore"}
            </button>
          </div>
        ))}
        {visibleItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            No tasks were completed in the last seven days.
          </p>
        ) : null}
      </div>
    </section>
  );
}
