"use client";

import {
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
import {
  CALENDAR_PX_PER_HOUR,
  placeCalendarEntries,
  type PlacedCalendarEntry,
} from "./calendar-layout";
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
  wakeHour: number;
  sleepHour: number;
};

type DayEntry =
  | {
      kind: "block";
      id: string;
      title: string;
      startMinutes: number;
      endMinutes: number;
      block: CalendarBlock;
    }
  | {
      kind: "event";
      id: string;
      title: string;
      startMinutes: number;
      endMinutes: number;
      event: CalendarEvent;
    }
  | {
      kind: "habit";
      id: string;
      title: string;
      startMinutes: number;
      endMinutes: number;
      habit: CalendarHabit;
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

function timeMinutes(value: string): number {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function timedRange(startAt: string, endAt: string) {
  const startMinutes = timeMinutes(startAt);
  const durationMinutes = Math.max(
    15,
    Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000),
  );
  return { startMinutes, endMinutes: startMinutes + durationMinutes };
}

function habitRange(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const startMinutes = hours * 60 + minutes;
  return { startMinutes, endMinutes: startMinutes + 30 };
}

function hourLabel(hour: number): string {
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${hour < 12 ? "am" : "pm"}`;
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

export function CalendarBoard({
  view,
  days,
  blocks,
  events,
  items,
  sources,
  habits,
  wakeHour,
  sleepHour,
}: Props) {
  const [hiddenSources, setHiddenSources] = useState<Record<string, true>>({});
  const [localBlocks, setLocalBlocks] = useState(blocks);
  const [localHabits, setLocalHabits] = useState(habits);
  const [selectedBlock, setSelectedBlock] = useState<CalendarBlock | null>(null);
  const [dragTargetDay, setDragTargetDay] = useState<string | null>(null);
  const [composerDay, setComposerDay] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const timelineHeight = Math.max(1, sleepHour - wakeHour) * CALENDAR_PX_PER_HOUR;
  const hourMarks = Array.from(
    { length: Math.max(1, sleepHour - wakeHour) + 1 },
    (_, index) => wakeHour + index,
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
    const previousSelected = selectedBlock;
    setLocalBlocks((current) => current.map((entry) => entry.id === block.id ? { ...entry, endAt: nextEnd.toISOString() } : entry));
    setSelectedBlock((current) =>
      current?.id === block.id
        ? { ...current, endAt: nextEnd.toISOString() }
        : current,
    );
    startTransition(async () => {
      const result = await updateBlockTimes({
        id: block.id,
        startAtIso: block.startAt,
        endAtIso: nextEnd.toISOString(),
      });
      setError(result.error);
      if (result.error) {
        setLocalBlocks(previous);
        setSelectedBlock(previousSelected);
      }
    });
  }

  function toggleLock(block: CalendarBlock) {
    const previous = localBlocks;
    const previousSelected = selectedBlock;
    const locked = !block.locked;
    setLocalBlocks((current) => current.map((entry) => entry.id === block.id ? { ...entry, locked } : entry));
    setSelectedBlock((current) =>
      current?.id === block.id ? { ...current, locked } : current,
    );
    startTransition(async () => {
      const result = await setBlockLocked({ id: block.id, locked });
      setError(result.error);
      if (result.error) {
        setLocalBlocks(previous);
        setSelectedBlock(previousSelected);
      }
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

  function renderEntry(
    entry: DayEntry,
    placement?: PlacedCalendarEntry<DayEntry>,
  ) {
    const placementStyle = placement
      ? {
          top: placement.top,
          height: placement.height,
          left: `calc(${(placement.lane / placement.laneCount) * 100}% + 5px)`,
          width: `calc(${100 / placement.laneCount}% - 10px)`,
          zIndex: placement.zIndex,
        }
      : undefined;
    const isTimeline = placement !== undefined;

    if (entry.kind === "habit") {
      return (
        <button
          key={entry.id}
          type="button"
          data-done={entry.habit.done}
          data-timeline={isTimeline}
          aria-pressed={entry.habit.done}
          aria-label={`Toggle completion for ${entry.habit.name} at ${habitTimeLabel(entry.habit.scheduledTime)}`}
          title={`${entry.habit.name}, ${habitTimeLabel(entry.habit.scheduledTime)}`}
          onClick={() => toggleHabit(entry.habit)}
          className="motion-calendar-habit calendar-entry-card"
          style={placementStyle}
        >
          <span
            className="completion-check calendar-habit-check"
            data-checked={entry.habit.done}
            aria-hidden="true"
          >
            {entry.habit.done ? "✓" : ""}
          </span>
          <span className="calendar-entry-title">{entry.title}</span>
        </button>
      );
    }

    if (entry.kind === "event") {
      const time = entry.event.allDay
        ? "All day"
        : `${clockLabel(entry.event.startAt)} to ${clockLabel(entry.event.endAt)}`;
      return (
        <article
          key={entry.id}
          data-timeline={isTimeline}
          aria-label={`${entry.title}, ${time}`}
          title={`${entry.title}, ${time}`}
          className="motion-calendar-event calendar-event-row calendar-entry-card"
          style={placementStyle}
        >
          <p className="calendar-entry-title">{entry.title}</p>
        </article>
      );
    }

    const time = `${clockLabel(entry.block.startAt)} to ${clockLabel(entry.block.endAt)}`;
    return (
      <button
        key={entry.id}
        type="button"
        draggable={!entry.block.done}
        data-timeline={isTimeline}
        aria-label={`${entry.title}, ${time}`}
        title={`${entry.title}, ${time}`}
        onDragStart={(event) => startBlockDrag(event, entry.block)}
        onClick={() => setSelectedBlock(entry.block)}
        className="motion-calendar-block calendar-block-row calendar-entry-card"
        style={placementStyle}
      >
        <span className="calendar-entry-title">{entry.title}</span>
      </button>
    );
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
        {view !== "month" ? (
          <aside className="calendar-time-column" aria-hidden="true">
            <div className="calendar-time-column-header" />
            <div className="calendar-time-column-all-day">All day</div>
            <div
              className="calendar-time-labels"
              style={{ height: timelineHeight }}
            >
              {hourMarks.map((hour, index) => (
                <span
                  key={hour}
                  style={{ top: index * CALENDAR_PX_PER_HOUR }}
                >
                  {hourLabel(hour)}
                </span>
              ))}
            </div>
          </aside>
        ) : null}
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
          const blockEntries: DayEntry[] = dayBlocks.map((block) => ({
            kind: "block",
            id: `block:${block.id}`,
            title: block.title,
            ...timedRange(block.startAt, block.endAt),
            block,
          }));
          const eventEntries: DayEntry[] = dayEvents
            .filter((event) => !event.allDay)
            .map((event) => ({
              kind: "event",
              id: `event:${event.id}`,
              title: event.title,
              ...timedRange(event.startAt, event.endAt),
              event,
            }));
          const allDayEntries: DayEntry[] = dayEvents
            .filter((event) => event.allDay)
            .map((event) => ({
              kind: "event",
              id: `event:${event.id}`,
              title: event.title,
              startMinutes: -1,
              endMinutes: 0,
              event,
            }));
          const habitEntries: DayEntry[] = dayHabits.map((habit) => ({
            kind: "habit",
            id: `habit:${habit.id}`,
            title: habit.name,
            ...habitRange(habit.scheduledTime),
            habit,
          }));
          const timedEntries = [
            ...blockEntries,
            ...eventEntries,
            ...habitEntries,
          ];
          const monthEntries = [...allDayEntries, ...timedEntries].sort(
            (a, b) =>
              a.startMinutes - b.startMinutes || a.id.localeCompare(b.id),
          );
          const placedEntries = placeCalendarEntries(
            timedEntries.map((entry) => ({
              value: entry,
              startMinutes: entry.startMinutes,
              endMinutes: entry.endMinutes,
            })),
            wakeHour,
            sleepHour,
          );
          const composer = composerDay === day ? (
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
          ) : null;
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
              {view === "month" ? (
                <div className="calendar-day-items">
                  {composer}
                  {monthEntries.map((entry) => renderEntry(entry))}
                </div>
              ) : (
                <>
                  <div className="calendar-all-day-strip">
                    {composer}
                    {allDayEntries.map((entry) => renderEntry(entry))}
                  </div>
                  <div
                    className="calendar-day-timeline"
                    style={{ height: timelineHeight }}
                  >
                    {hourMarks.map((hour, index) => (
                      <span
                        key={hour}
                        className="calendar-hour-line"
                        style={{ top: index * CALENDAR_PX_PER_HOUR }}
                        aria-hidden="true"
                      />
                    ))}
                    {placedEntries.map((entry) =>
                      renderEntry(entry.value, entry),
                    )}
                  </div>
                </>
              )}
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
          <div className="calendar-detail-actions">
            <button
              type="button"
              onClick={() => resizeBlock(selectedBlock, -15)}
            >
              Shorten 15 min
            </button>
            <button
              type="button"
              onClick={() => resizeBlock(selectedBlock, 15)}
            >
              Extend 15 min
            </button>
            <button
              type="button"
              onClick={() => toggleLock(selectedBlock)}
            >
              {selectedBlock.locked ? "Unlock" : "Lock"}
            </button>
          </div>
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
