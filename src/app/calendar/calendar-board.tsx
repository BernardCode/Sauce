"use client";

import { useMemo, useState, useTransition, type DragEvent } from "react";
import { Lock, LockOpen, Plus, X } from "lucide-react";
import { z } from "zod";
import {
  createBlockForItem,
  deleteBlock,
  setBlockLocked,
  updateBlockTimes,
} from "@/app/today/block-actions";
import { createManualBlock } from "./actions";
import type {
  CalendarBlock,
  CalendarEvent,
  CalendarItem,
  CalendarSource,
} from "./types";

const dragPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("block"),
    id: z.uuid(),
    startAt: z.iso.datetime({ offset: true }),
    endAt: z.iso.datetime({ offset: true }),
  }),
  z.object({
    kind: z.literal("item"),
    id: z.uuid(),
    durationMinutes: z.number().int().positive().max(12 * 60),
  }),
]);

const DRAG_TYPE = "application/x-dashboard-calendar";

type Props = {
  view: "month" | "week" | "day";
  days: string[];
  blocks: CalendarBlock[];
  events: CalendarEvent[];
  items: CalendarItem[];
  sources: CalendarSource[];
};

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clockLabel(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLabel(value: string, view: Props["view"]): string {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: view === "month" ? "short" : "long",
    month: "short",
    day: "numeric",
  });
}

function readDragPayload(event: DragEvent): z.infer<typeof dragPayloadSchema> | null {
  const raw = event.dataTransfer.getData(DRAG_TYPE);
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = dragPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function moveToDay(iso: string, day: string): Date {
  const original = new Date(iso);
  const [year, month, date] = day.split("-").map(Number);
  return new Date(
    year,
    month - 1,
    date,
    original.getHours(),
    original.getMinutes(),
  );
}

export function CalendarBoard({ view, days, blocks, events, items, sources }: Props) {
  const [hiddenSources, setHiddenSources] = useState<Record<string, true>>({});
  const [localBlocks, setLocalBlocks] = useState(blocks);
  const [selectedBlock, setSelectedBlock] = useState<CalendarBlock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sourceLabels = useMemo(
    () => Object.fromEntries(sources.map((source) => [source.id, source.label])),
    [sources],
  );

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  function startBlockDrag(event: DragEvent, block: CalendarBlock) {
    event.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({
        kind: "block",
        id: block.id,
        startAt: block.startAt,
        endAt: block.endAt,
      }),
    );
    event.dataTransfer.effectAllowed = "move";
  }

  function startItemDrag(event: DragEvent, item: CalendarItem) {
    event.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({
        kind: "item",
        id: item.id,
        durationMinutes: Math.min(
          12 * 60,
          Math.max(15, item.remainingMinutes ?? item.estMinutes ?? 60),
        ),
      }),
    );
    event.dataTransfer.effectAllowed = "copy";
  }

  function dropOnDay(event: DragEvent, day: string) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (!payload) return;
    if (payload.kind === "block") {
      const start = moveToDay(payload.startAt, day);
      const duration = new Date(payload.endAt).getTime() - new Date(payload.startAt).getTime();
      const end = new Date(start.getTime() + duration);
      const previous = localBlocks;
      setLocalBlocks((current) => current.map((block) => block.id === payload.id ? { ...block, startAt: start.toISOString(), endAt: end.toISOString() } : block));
      startTransition(async () => {
        const result = await updateBlockTimes({
          id: payload.id,
          startAtIso: start.toISOString(),
          endAtIso: end.toISOString(),
        });
        setError(result.error);
        if (result.error) setLocalBlocks(previous);
      });
      return;
    }

    const start = new Date(`${day}T09:00:00`);
    run(() =>
      createBlockForItem({
        itemId: payload.id,
        startAtIso: start.toISOString(),
        endAtIso: new Date(
          start.getTime() + payload.durationMinutes * 60_000,
        ).toISOString(),
      }),
    );
  }

  function addManualBlock(day: string) {
    const title = window.prompt("Block title");
    if (!title?.trim()) return;
    const start = new Date(`${day}T09:00:00`);
    run(() =>
      createManualBlock({
        title,
        startAtIso: start.toISOString(),
        endAtIso: new Date(start.getTime() + 60 * 60_000).toISOString(),
      }),
    );
  }

  function resizeBlock(block: CalendarBlock, deltaMinutes: number) {
    const nextEnd = new Date(new Date(block.endAt).getTime() + deltaMinutes * 60_000);
    if (nextEnd <= new Date(block.startAt)) return;
    const previous = localBlocks;
    setLocalBlocks((current) => current.map((entry) => entry.id === block.id ? { ...entry, endAt: nextEnd.toISOString() } : entry));
    startTransition(async () => {
      const result = await updateBlockTimes({
        id: block.id,
        startAtIso: block.startAt,
        endAtIso: nextEnd.toISOString(),
      });
      setError(result.error);
      if (result.error) setLocalBlocks(previous);
    });
  }

  function toggleLock(block: CalendarBlock) {
    const previous = localBlocks;
    const locked = !block.locked;
    setLocalBlocks((current) => current.map((entry) => entry.id === block.id ? { ...entry, locked } : entry));
    startTransition(async () => {
      const result = await setBlockLocked({ id: block.id, locked });
      setError(result.error);
      if (result.error) setLocalBlocks(previous);
    });
  }

  function removeBlock(block: CalendarBlock) {
    const previous = localBlocks;
    setLocalBlocks((current) => current.filter((entry) => entry.id !== block.id));
    setSelectedBlock(null);
    startTransition(async () => {
      const result = await deleteBlock({ id: block.id });
      setError(result.error);
      if (result.error) setLocalBlocks(previous);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          {sources.map((source) => (
            <label key={source.id} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!hiddenSources[source.id]}
                onChange={(event) =>
                  setHiddenSources((current) => {
                    const next = { ...current };
                    if (event.target.checked) delete next[source.id];
                    else next[source.id] = true;
                    return next;
                  })
                }
              />
              {source.label}
            </label>
          ))}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div
        className={`grid flex-1 gap-2 ${
          view === "day"
            ? "grid-cols-1"
            : view === "week"
              ? "grid-cols-1 md:grid-cols-7"
              : "grid-cols-2 md:grid-cols-7"
        }`}
      >
        {days.map((day) => {
          const dayBlocks = localBlocks.filter(
            (block) => localDateKey(new Date(block.startAt)) === day,
          );
          const dayEvents = events.filter(
            (event) =>
              localDateKey(new Date(event.startAt)) === day &&
              !hiddenSources[event.sourceId],
          );
          return (
            <section
              key={day}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => dropOnDay(event, day)}
              className={`min-h-32 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-2.5 hover:border-indigo-200 dark:hover:border-indigo-800 ${
                view === "month" ? "min-h-40" : "min-h-96"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-medium text-zinc-500">
                  {dayLabel(day, view)}
                </h2>
                <button
                  type="button"
                  onClick={() => addManualBlock(day)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-deep)]"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {dayEvents.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-lg border border-sky-200 bg-[var(--sky-soft)] px-2.5 py-2 text-xs text-sky-900 dark:border-sky-900 dark:text-sky-200"
                  >
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="truncate opacity-70">
                      {event.allDay ? "All day" : clockLabel(event.startAt)}
                      {sourceLabels[event.sourceId]
                        ? `, ${sourceLabels[event.sourceId]}`
                        : ""}
                    </p>
                  </article>
                ))}
                {dayBlocks.map((block) => (
                  <article
                    key={block.id}
                    draggable={!block.done}
                    onDragStart={(event) => startBlockDrag(event, block)}
                    onClick={() => setSelectedBlock(block)}
                    className="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-xs text-indigo-950 shadow-sm hover:-translate-y-0.5 hover:shadow-md dark:border-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-100"
                  >
                    <p className="truncate font-medium">{block.title}</p>
                    <p className="text-zinc-500">
                      {clockLabel(block.startAt)} to {clockLabel(block.endAt)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-zinc-400">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          resizeBlock(block, -15);
                        }}
                      >
                        -15m
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          resizeBlock(block, 15);
                        }}
                      >
                        +15m
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleLock(block);
                        }}
                        className="inline-flex items-center gap-1"
                      >
                        {block.locked ? <LockOpen size={11} /> : <Lock size={11} />}{block.locked ? "Unlock" : "Lock"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <details className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-subtle)] p-3">
        <summary className="cursor-pointer text-sm text-zinc-500">
          Unscheduled ({items.length})
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              draggable
              onDragStart={(event) => startItemDrag(event, item)}
              className="cursor-grab rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
            >
              {item.title}
            </button>
          ))}
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">Everything open is scheduled.</p>
          ) : null}
        </div>
      </details>

      {selectedBlock ? (
        <aside className="fixed right-4 bottom-20 z-40 w-80 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl lg:bottom-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-medium">{selectedBlock.title}</h2>
            <button
              type="button"
              onClick={() => setSelectedBlock(null)}
              aria-label="Close block details"
              className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            {clockLabel(selectedBlock.startAt)} to {clockLabel(selectedBlock.endAt)}
          </p>
          {selectedBlock.reason ? (
            <p className="mt-2 text-sm text-zinc-500">Why: {selectedBlock.reason}</p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              removeBlock(selectedBlock);
            }}
            className="mt-4 text-sm text-red-600"
          >
            Unschedule
          </button>
        </aside>
      ) : null}
    </div>
  );
}
