"use client";

import { useState, useTransition, type DragEvent } from "react";
import { setItemDone } from "@/app/today/actions";
import {
  addProjectStep,
  deleteProjectStep,
  reorderProjectSteps,
  updateProjectStep,
} from "./actions";

export type ProjectStep = {
  id: string;
  title: string;
  estMinutes: number | null;
  dueAt: string | null;
  status: string;
  origin: string;
  blockStart: string | null;
};

function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isoOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function StepList({
  projectId,
  steps: initialSteps,
}: {
  projectId: string;
  steps: ProjectStep[];
}) {
  const [steps, setSteps] = useState(initialSteps);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [completingStepId, setCompletingStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function moveBefore(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const next = [...steps];
    const from = next.findIndex((step) => step.id === draggedId);
    const to = next.findIndex((step) => step.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSteps(next);
    startTransition(async () => {
      const result = await reorderProjectSteps({
        projectId,
        orderedStepIds: next.map((step) => step.id),
      });
      if (result.error) {
        setSteps(initialSteps);
        setError(result.error);
      } else {
        setError(null);
      }
    });
  }

  function drop(event: DragEvent<HTMLLIElement>, targetId: string) {
    event.preventDefault();
    moveBefore(targetId);
    setDraggedId(null);
  }

  return (
    <div className="motion-step-list flex flex-col gap-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="flex flex-col gap-2" aria-label="Project steps">
        {steps.map((step) => {
          const checked = step.status === "done" || completingStepId === step.id;
          return (
            <li
              key={step.id}
              draggable={!isPending}
              onDragStart={() => setDraggedId(step.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, step.id)}
              className="motion-step-row rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
            <form
              className="grid gap-2 sm:grid-cols-[auto_1fr_6rem_12rem_auto_auto] sm:items-center"
              action={(formData) => {
                startTransition(async () => {
                  const result = await updateProjectStep({
                    id: step.id,
                    title: String(formData.get("title") ?? ""),
                    estMinutes: Number(formData.get("estimate")),
                    dueAtIso: isoOrNull(String(formData.get("due") ?? "")),
                  });
                  setError(result.error);
                });
              }}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`Toggle completion for ${step.title}`}
                data-checked={checked}
                disabled={step.status === "done" || isPending}
                onClick={() => {
                  setCompletingStepId(step.id);
                  startTransition(async () => {
                    const result = await setItemDone({ id: step.id });
                    setError(result.error);
                    if (result.error) {
                      setCompletingStepId(null);
                      return;
                    }
                    setSteps((current) =>
                      current.map((entry) =>
                        entry.id === step.id
                          ? { ...entry, status: "done" }
                          : entry,
                      ),
                    );
                    setCompletingStepId(null);
                  });
                }}
                className="completion-check"
              >
                <span aria-hidden="true">✓</span>
              </button>
              <input
                name="title"
                defaultValue={step.title}
                aria-label="Step title"
                className="min-w-0 rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
              />
              <input
                name="estimate"
                type="number"
                min={1}
                max={10_000}
                defaultValue={step.estMinutes ?? 60}
                aria-label="Estimated minutes"
                className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
              />
              <input
                name="due"
                type="datetime-local"
                defaultValue={dateInputValue(step.dueAt)}
                aria-label="Target date"
                className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
              />
              <button
                type="submit"
                disabled={isPending}
                className="text-sm text-zinc-600 hover:text-zinc-950 disabled:opacity-50 dark:hover:text-white"
              >
                Save
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteProjectStep({ id: step.id });
                    setError(result.error);
                  })
                }
                className="text-sm text-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            </form>
            <p className="mt-2 text-xs text-zinc-500">
              {step.blockStart
                ? `Scheduled ${new Date(step.blockStart).toLocaleString()}`
                : "Not yet placed"}
              {step.origin === "manual" ? " · protected from re-break-down" : ""}
            </p>
            </li>
          );
        })}
      </ul>

      <form
        className="grid gap-2 rounded-lg border border-dashed border-zinc-300 p-3 sm:grid-cols-[1fr_6rem_12rem_auto] dark:border-zinc-700"
        action={(formData) => {
          startTransition(async () => {
            const result = await addProjectStep({
              projectId,
              title: String(formData.get("title") ?? ""),
              estMinutes: Number(formData.get("estimate")),
              dueAtIso: isoOrNull(String(formData.get("due") ?? "")),
            });
            setError(result.error);
          });
        }}
      >
        <input
          name="title"
          required
          placeholder="Add a step"
          className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
        <input
          name="estimate"
          type="number"
          required
          min={1}
          defaultValue={60}
          aria-label="Estimated minutes"
          className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
        <input
          name="due"
          type="datetime-local"
          aria-label="Target date"
          className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add step
        </button>
      </form>
    </div>
  );
}
