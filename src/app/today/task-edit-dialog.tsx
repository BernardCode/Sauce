"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { updateItem } from "./actions";
import type { TodayItem } from "./task-types";

function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function endOfDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function TaskEditDialog({
  item,
  open,
  onClose,
}: {
  item: TodayItem;
  open: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const estimateValue = String(form.get("estimate") ?? "").trim();
    startTransition(async () => {
      const result = await updateItem({
        id: item.id,
        title: String(form.get("title") ?? ""),
        category: String(form.get("category") ?? "").trim() || null,
        plannedDate: String(form.get("plannedDate") ?? "").trim() || null,
        dueAtIso: endOfDate(String(form.get("dueDate") ?? "")),
        estMinutes: estimateValue ? Number(estimateValue) : null,
      });
      setError(result.error);
      if (!result.error) onClose();
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`edit-task-${item.id}`}
        className="w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="page-kicker">Task details</p>
            <h2 id={`edit-task-${item.id}`} className="mt-1 text-lg font-semibold">Edit task</h2>
          </div>
          <button type="button" onClick={onClose} disabled={isPending} className="min-h-11 px-3 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Close</button>
        </div>
        <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-[var(--muted)]">Title</span>
            <input name="title" defaultValue={item.title} required maxLength={500} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--primary)]" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-[var(--muted)]">Class or category</span>
            <input name="category" defaultValue={item.course ?? ""} maxLength={100} placeholder="Systems Design, Rice Essays..." className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--primary)]" />
          </label>
          <label>
            <span className="text-xs font-semibold text-[var(--muted)]">Show on Today</span>
            <input name="plannedDate" type="date" defaultValue={item.plannedDate ?? ""} disabled={item.isLater} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--primary)] disabled:opacity-55" />
            {item.isLater ? (
              <span className="mt-1 block text-xs text-[var(--muted)]">
                Move this task to Main before choosing a Today date.
              </span>
            ) : null}
          </label>
          <label>
            <span className="text-xs font-semibold text-[var(--muted)]">Deadline</span>
            <input name="dueDate" type="date" defaultValue={dateInputValue(item.dueAt)} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--primary)]" />
          </label>
          <label>
            <span className="text-xs font-semibold text-[var(--muted)]">Estimated minutes</span>
            <input name="estimate" type="number" min={1} max={600} defaultValue={item.estMinutes ?? ""} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 text-sm outline-none focus:border-[var(--primary)]" />
          </label>
          <div className="flex items-end justify-end sm:col-span-2">
            <button type="submit" disabled={isPending} className="min-h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60">{isPending ? "Saving" : "Save changes"}</button>
          </div>
          {error ? <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p> : null}
        </form>
      </section>
    </div>,
    document.body,
  );
}
