"use client";

import {
  useMemo,
  useState,
  useTransition,
  type DragEvent,
  type FormEvent,
} from "react";
import { z } from "zod";
import {
  createBlockForItem,
  deleteBlock,
  setBlockLocked,
  updateBlockTimes,
} from "@/app/today/block-actions";
import { setHabitLog } from "@/app/habits/actions";
import { createManualBlock } from "./actions";
import type {
  CalendarBlock,
  CalendarEvent,
  CalendarHabit,
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
  habits: CalendarHabit[];
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
    weekday: view === "day" ? "long" : "short",
    month: "short",
    day: "numeric",
  });
}

function habitTimeLabel(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
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

export function CalendarBoard({ view, days, blocks, events, items, sources, habits }: Props) {
  const [hiddenSources, setHiddenSources] = useState<Record<string, true>>({});
  const [localBlocks, setLocalBlocks] = useState(blocks);
  const [localHabits, setLocalHabits] = useState(habits);
  const [selectedBlock, setSelectedBlock] = useState<CalendarBlock | null>(null);
  const [dragTargetDay, setDragTargetDay] = useState<string | null>(null);
  const [composerDay, setComposerDay] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState("");
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
    setDragTargetDay(null);
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

  function addManualBlock(event: FormEvent<HTMLFormElement>, day: string) {
    event.preventDefault();
    const title = manualTitle.trim();
    if (!title) return;

    const start = new Date(`${day}T09:00:00`);
    const end = new Date(start.getTime() + 60 * 60_000);
    const optimisticId = crypto.randomUUID();
    const optimisticBlock: CalendarBlock = {
      id: optimisticId,
      itemId: null,
      title,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      locked: false,
      done: false,
      reason: null,
    };

    setLocalBlocks((current) => [...current, optimisticBlock]);
    setManualTitle("");
    setComposerDay(null);
    setError(null);

    startTransition(async () => {
      const result = await createManualBlock({
        title,
        startAtIso: start.toISOString(),
        endAtIso: end.toISOString(),
      });
      setError(result.error);
      if (result.error || !result.block) {
        setLocalBlocks((current) =>
          current.filter((block) => block.id !== optimisticId),
        );
        return;
      }
      const savedBlock: CalendarBlock = result.block;
      setLocalBlocks((current) =>
        current.map((block) =>
          block.id === optimisticId ? savedBlock : block,
        ),
      );
    });
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

  function toggleHabit(habit: CalendarHabit) {
    const previous = localHabits;
    const done = !habit.done;
    setLocalHabits((current) =>
      current.map((entry) => entry.id === habit.id ? { ...entry, done } : entry),
    );
    startTransition(async () => {
      const result = await setHabitLog({
        habitId: habit.habitId,
        date: habit.date,
        done,
      });
      setError(result.error);
      if (result.error) setLocalHabits(previous);
    });
  }

  return (
    <div className="motion-calendar calendar-workspace" data-view={view}>
      <header className="neutral-panel-header calendar-board-header">
        <div className="neutral-panel-heading">
          <span className="neutral-panel-label">Schedule</span>
          <span className="neutral-panel-count">
            {localBlocks.length + events.length + localHabits.length}
          </span>
        </div>
        <div className="calendar-source-filters" aria-label="Visible calendars">
          {sources.map((source) => (
            <label key={source.id} className="motion-source-filter calendar-source-filter">
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
      </header>

      {error ? <p className="neutral-feedback" role="alert">{error}</p> : null}

      <div
        className={`calendar-days ${
          view === "day"
            ? "calendar-days-day"
            : view === "week"
              ? "calendar-days-week"
              : "calendar-days-month"
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
          const dayHabits = localHabits.filter((habit) => habit.date === day);
          return (
            <section
              key={day}
              onDragOver={(event) => event.preventDefault()}
              onDragEnter={() => setDragTargetDay(day)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragTargetDay((current) => current === day ? null : current);
                }
              }}
              onDrop={(event) => dropOnDay(event, day)}
              data-drop-target={dragTargetDay === day}
              data-today={day === localDateKey(new Date())}
              className="motion-calendar-day calendar-day"
            >
              <header className="calendar-day-header">
                <h2>
                  {dayLabel(day, view)}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setComposerDay((current) => current === day ? null : day);
                    setManualTitle("");
                  }}
                  disabled={isPending}
                  className="motion-calendar-add calendar-day-add"
                >
                  New block
                </button>
              </header>
              <div className="calendar-day-items">
                {composerDay === day ? (
                  <form
                    onSubmit={(event) => addManualBlock(event, day)}
                    className="calendar-block-composer"
                  >
                    <input
                      value={manualTitle}
                      onChange={(event) => setManualTitle(event.target.value)}
                      placeholder="Block title"
                      aria-label={`New block for ${dayLabel(day, view)}`}
                      autoFocus
                    />
                    <div>
                      <span>9:00 AM, 60 min</span>
                      <button type="submit" disabled={isPending || !manualTitle.trim()}>
                        Add
                      </button>
                    </div>
                  </form>
                ) : null}
                {dayHabits.map((habit) => (
                  <button
                    key={habit.id}
                    type="button"
                    data-done={habit.done}
                    aria-pressed={habit.done}
                    aria-label={`Mark ${habit.name} ${habit.done ? "not done" : "done"} for ${habit.date}`}
                    onClick={() => toggleHabit(habit)}
                    className="motion-calendar-habit"
                  >
                    <span className="calendar-habit-check" aria-hidden="true">{habit.done ? "✓" : ""}</span>
                    <span className="calendar-habit-copy">
                      <span className="calendar-habit-title">{habit.name}</span>
                      <span className="calendar-habit-time">{habitTimeLabel(habit.scheduledTime)}, habit</span>
                    </span>
                  </button>
                ))}
                {dayEvents.map((event) => (
                  <article
                    key={event.id}
                    className="motion-calendar-event calendar-event-row"
                  >
                    <p className="calendar-entry-title">{event.title}</p>
                    <p className="calendar-entry-meta">
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
                    className="motion-calendar-block calendar-block-row"
                  >
                    <p className="calendar-entry-title">{block.title}</p>
                    <p className="calendar-entry-meta">
                      {clockLabel(block.startAt)} to {clockLabel(block.endAt)}
                    </p>
                    <div className="calendar-block-actions">
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
                      >
                        {block.locked ? "Unlock" : "Lock"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <details className="motion-disclosure calendar-unscheduled">
        <summary>
          Unscheduled ({items.length})
        </summary>
        <div className="calendar-unscheduled-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              draggable
              onDragStart={(event) => startItemDrag(event, item)}
              className="motion-draggable-item calendar-unscheduled-row"
            >
              {item.title}
            </button>
          ))}
          {items.length === 0 ? (
            <p className="neutral-empty-row">Everything open is scheduled.</p>
          ) : null}
        </div>
      </details>

      {selectedBlock ? (
        <aside className="motion-detail-panel calendar-detail-panel">
          <div className="calendar-detail-header">
            <h2>{selectedBlock.title}</h2>
            <button
              type="button"
              onClick={() => setSelectedBlock(null)}
              aria-label="Close block details"
              className="motion-panel-close"
            >
              Close
            </button>
          </div>
          <p className="calendar-detail-time">
            {clockLabel(selectedBlock.startAt)} to {clockLabel(selectedBlock.endAt)}
          </p>
          {selectedBlock.reason ? (
            <p className="calendar-detail-reason">{selectedBlock.reason}</p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              removeBlock(selectedBlock);
            }}
            className="calendar-unschedule-button"
          >
            Unschedule
          </button>
        </aside>
      ) : null}
    </div>
  );
}
