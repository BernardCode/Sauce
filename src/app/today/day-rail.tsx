"use client";

import type {
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { z } from "zod";
import { setHabitLog } from "@/app/habits/actions";
import {
  createBlockForItem,
  deleteBlock,
  setBlockLocked,
  updateBlockTimes,
} from "./block-actions";
import { BlockCard, type DragMode } from "./block-card";
import { BlockPopover } from "./block-popover";
import {
  BLOCK_HIGHLIGHT_EVENT,
  ITEM_DRAG_MIME,
  type BlockHighlightDetail,
  type ItemDragPayload,
  type TodayBlock,
  type TodayEvent,
  type TodayScheduledHabit,
} from "./types";
import { useNow } from "./use-now";

const PX_PER_HOUR = 64;
const PX_PER_MINUTE = PX_PER_HOUR / 60;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const SNAP_MINUTES = 15;
const SNAP_MS = SNAP_MINUTES * MINUTE_MS;
// Below this movement a press is a click, not a drag.
const DRAG_THRESHOLD_PX = 4;
// Releasing a move this far past either rail edge deletes the block.
const OFF_RAIL_PX = 48;
const LABEL_GUTTER_PX = 40;
const POPOVER_WIDTH_PX = 256;
const INDENT_STEP_PX = 12;

type Props = {
  blocks: TodayBlock[];
  events?: TodayEvent[];
  habits?: TodayScheduledHabit[];
  wakeHour: number;
  sleepHour: number;
  // Due dates by item id for the popover. Optional so the page can wire it
  // up later without touching this component.
  itemDueDates?: Record<string, string | null>;
};

type DragState = {
  blockId: string;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  origStartMs: number;
  origEndMs: number;
  previewStartMs: number;
  previewEndMs: number;
  moved: boolean;
  offRail: boolean;
};

type PopoverState = { blockId: string; top: number; left: number };

type PlacedBlock = {
  block: TodayBlock;
  startMs: number;
  endMs: number;
  top: number;
  height: number;
  indent: number;
  zIndex: number;
};

type PlacedEvent = {
  event: TodayEvent;
  top: number;
  height: number;
};

type PlacedHabit = {
  habit: TodayScheduledHabit;
  top: number;
};

const itemDragPayloadSchema = z.object({
  itemId: z.uuid(),
  durationMinutes: z.number().finite().positive().max(12 * 60),
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snapToSlot(ms: number, windowStartMs: number): number {
  return windowStartMs + Math.round((ms - windowStartMs) / SNAP_MS) * SNAP_MS;
}

function hourLabel(hour: number): string {
  const inDay = hour % 24;
  const display = inDay % 12 === 0 ? 12 : inDay % 12;
  return `${display}${inDay < 12 ? "am" : "pm"}`;
}

function habitTimeLabel(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function habitMinute(value: string): number | null {
  const [hours, minutes] = value.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function parseItemDragPayload(raw: string): ItemDragPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = itemDragPayloadSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export function DayRail({
  blocks,
  events = [],
  habits = [],
  wakeHour,
  sleepHour,
  itemDueDates = {},
}: Props) {
  // Null on the server and first client frame, so the block layer only
  // renders once the browser's local day is known. The grid itself is
  // date-free and safe to render everywhere.
  const now = useNow();

  const railRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // The ref is the authoritative drag record for event handlers; the state
  // copy exists only so the preview renders. Keeping both avoids stale
  // closures without re-subscribing anything per pointer move.
  const dragRef = useRef<DragState | null>(null);

  const [drag, setDragView] = useState<DragState | null>(null);
  const [movedTimes, setMovedTimes] = useState<
    Record<string, { startAt: string; endAt: string }>
  >({});
  const [removedIds, setRemovedIds] = useState<Record<string, true>>({});
  const [pendingCreate, setPendingCreate] = useState<{
    startMs: number;
    endMs: number;
  } | null>(null);
  const [dropPreviewMinute, setDropPreviewMinute] = useState<number | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [habitDoneById, setHabitDoneById] = useState<Record<string, boolean>>(
    () => Object.fromEntries(habits.map((habit) => [habit.habitId, habit.done])),
  );
  const [isPending, startTransition] = useTransition();

  // A sleep hour at or before the wake hour would collapse the rail, so
  // fall back to a one hour window rather than divide into nonsense.
  const windowHours = Math.max(1, sleepHour - wakeHour);
  const windowMinutes = windowHours * 60;
  const railHeight = windowHours * PX_PER_HOUR;

  const dayStartMs = now
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    : null;
  const windowStartMs =
    dayStartMs === null ? null : dayStartMs + wakeHour * HOUR_MS;
  const windowEndMs =
    windowStartMs === null ? null : windowStartMs + windowMinutes * MINUTE_MS;

  // One listener for the whole rail; cards just get a highlighted flag.
  useEffect(() => {
    function onHighlight(event: Event) {
      const detail = (event as CustomEvent<BlockHighlightDetail>).detail;
      if (!detail) return;
      setHighlightId((prev) =>
        detail.on ? detail.blockId : prev === detail.blockId ? null : prev,
      );
    }
    window.addEventListener(BLOCK_HIGHLIGHT_EVENT, onHighlight);
    return () => window.removeEventListener(BLOCK_HIGHLIGHT_EVENT, onHighlight);
  }, []);

  const popoverOpen = popover !== null;
  useEffect(() => {
    if (!popoverOpen) return;
    function onWindowPointerDown(event: PointerEvent) {
      const el = popoverRef.current;
      if (el && event.target instanceof Node && el.contains(event.target)) return;
      setPopover(null);
    }
    window.addEventListener("pointerdown", onWindowPointerDown);
    return () => window.removeEventListener("pointerdown", onWindowPointerDown);
  }, [popoverOpen]);

  function setDrag(next: DragState | null) {
    dragRef.current = next;
    setDragView(next);
  }

  // Optimistic overlay over props: removed blocks vanish, moved blocks show
  // their new times, and the live drag preview wins over everything.
  const overlaid = blocks
    .filter((block) => !removedIds[block.id])
    .map((block) => {
      const times = movedTimes[block.id];
      return times
        ? { ...block, startAt: times.startAt, endAt: times.endAt }
        : block;
    })
    .map((block) =>
      drag !== null && drag.moved && drag.blockId === block.id
        ? {
            ...block,
            startAt: new Date(drag.previewStartMs).toISOString(),
            endAt: new Date(drag.previewEndMs).toISOString(),
          }
        : block,
    );

  const placed: PlacedBlock[] = [];
  const placedEvents: PlacedEvent[] = [];
  const placedHabits: PlacedHabit[] = [];
  if (windowStartMs !== null && windowEndMs !== null) {
    for (const habit of habits) {
      const scheduledMinute = habitMinute(habit.scheduledTime);
      if (scheduledMinute === null) continue;
      const minuteFromWake = scheduledMinute - wakeHour * 60;
      if (minuteFromWake < 0 || minuteFromWake >= windowMinutes) continue;
      placedHabits.push({
        habit,
        top: minuteFromWake * PX_PER_MINUTE,
      });
    }

    for (const event of events) {
      if (event.allDay) continue;
      const startMs = Date.parse(event.startAt);
      const endMs = Date.parse(event.endAt);
      if (startMs >= windowEndMs || endMs <= windowStartMs) continue;
      const topMinute = clamp(
        (startMs - windowStartMs) / MINUTE_MS,
        0,
        windowMinutes,
      );
      const bottomMinute = clamp(
        (endMs - windowStartMs) / MINUTE_MS,
        0,
        windowMinutes,
      );
      placedEvents.push({
        event,
        top: topMinute * PX_PER_MINUTE,
        height: Math.max((bottomMinute - topMinute) * PX_PER_MINUTE, 12),
      });
    }

    const todays = overlaid
      .map((block) => ({
        block,
        startMs: Date.parse(block.startAt),
        endMs: Date.parse(block.endAt),
      }))
      .filter((entry) => entry.startMs < windowEndMs && entry.endMs > windowStartMs)
      .sort(
        (a, b) => a.startMs - b.startMs || a.block.id.localeCompare(b.block.id),
      );
    for (const entry of todays) {
      const topMinute = clamp(
        (entry.startMs - windowStartMs) / MINUTE_MS,
        0,
        windowMinutes,
      );
      const bottomMinute = clamp(
        (entry.endMs - windowStartMs) / MINUTE_MS,
        0,
        windowMinutes,
      );
      // Naive overlap handling: each later block indents past everything it
      // overlaps and stacks above it. Fine for a hand-built day.
      const depth = Math.min(
        placed.filter((p) => p.startMs < entry.endMs && p.endMs > entry.startMs)
          .length,
        6,
      );
      placed.push({
        ...entry,
        top: topMinute * PX_PER_MINUTE,
        height: Math.max((bottomMinute - topMinute) * PX_PER_MINUTE, 12),
        indent: depth * INDENT_STEP_PX,
        zIndex:
          drag !== null && drag.blockId === entry.block.id ? 30 : 10 + depth,
      });
    }
  }

  const popoverBlock = popover
    ? (placed.find((entry) => entry.block.id === popover.blockId)?.block ?? null)
    : null;
  const popoverDueAt =
    popoverBlock && popoverBlock.itemId !== null
      ? (itemDueDates[popoverBlock.itemId] ?? null)
      : null;

  const nowMs = now ? now.getTime() : null;
  const allDayEvents = now === null ? [] : events.filter((event) => event.allDay);
  const nowTop =
    nowMs !== null &&
    windowStartMs !== null &&
    windowEndMs !== null &&
    nowMs >= windowStartMs &&
    nowMs <= windowEndMs
      ? ((nowMs - windowStartMs) / MINUTE_MS) * PX_PER_MINUTE
      : null;

  const hourMarks = Array.from(
    { length: windowHours + 1 },
    (_, index) => wakeHour + index,
  );

  function openPopover(entry: PlacedBlock) {
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    // Clamp horizontally so the popover stays inside the rail and viewport;
    // vertically the page just scrolls, so a soft cap is enough.
    const maxLeft =
      Math.min(rect.width, window.innerWidth - rect.left - 8) - POPOVER_WIDTH_PX;
    const left = clamp(LABEL_GUTTER_PX + 4, 0, Math.max(0, maxLeft));
    const top = clamp(
      entry.top + entry.height + 6,
      0,
      Math.max(0, railHeight - 160),
    );
    setPopover({ blockId: entry.block.id, top, left });
  }

  function openPopoverForBlock(block: TodayBlock) {
    const entry = placed.find((candidate) => candidate.block.id === block.id);
    if (entry) openPopover(entry);
  }

  function commitTimes(blockId: string, startMs: number, endMs: number) {
    const startAt = new Date(startMs).toISOString();
    const endAt = new Date(endMs).toISOString();
    setActionError(null);
    setMovedTimes((prev) => ({ ...prev, [blockId]: { startAt, endAt } }));
    startTransition(async () => {
      const result = await updateBlockTimes({
        id: blockId,
        startAtIso: startAt,
        endAtIso: endAt,
      });
      if (result.error) setActionError(result.error);
      // Drop the overlay entry either way, but only if a newer drag has not
      // replaced it: on success the refreshed props already carry the new
      // times, on failure the block snaps back to the server truth.
      setMovedTimes((prev) => {
        const entry = prev[blockId];
        if (!entry || entry.startAt !== startAt || entry.endAt !== endAt) {
          return prev;
        }
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
    });
  }

  function commitDelete(blockId: string) {
    setActionError(null);
    setRemovedIds((prev) => ({ ...prev, [blockId]: true }));
    startTransition(async () => {
      const result = await deleteBlock({ id: blockId });
      if (result.error) {
        setActionError(result.error);
        // A failed delete restores the block. A successful one can keep the
        // id in the set; the row is gone from props, so it is inert.
        setRemovedIds((prev) => {
          const next = { ...prev };
          delete next[blockId];
          return next;
        });
      }
    });
  }

  function handleToggleLock(block: TodayBlock) {
    setActionError(null);
    startTransition(async () => {
      const result = await setBlockLocked({ id: block.id, locked: !block.locked });
      if (result.error) setActionError(result.error);
    });
  }

  function handleToggleHabit(habit: TodayScheduledHabit) {
    const previous = habitDoneById[habit.habitId] ?? false;
    const done = !previous;
    setHabitDoneById((current) => ({ ...current, [habit.habitId]: done }));
    setActionError(null);
    startTransition(async () => {
      const result = await setHabitLog({
        habitId: habit.habitId,
        date: habit.date,
        done,
      });
      if (result.error) {
        setActionError(result.error);
        setHabitDoneById((current) => ({
          ...current,
          [habit.habitId]: previous,
        }));
      }
    });
  }

  function handlePressStart(
    event: ReactPointerEvent<HTMLDivElement>,
    block: TodayBlock,
    mode: DragMode,
  ) {
    if (event.button !== 0 || windowStartMs === null) return;
    // Capture so the drag keeps tracking even when the pointer leaves the
    // card or the rail entirely.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer can be gone by the time capture is requested. The drag
      // still works, it just stops tracking outside the card.
    }
    const startMs = Date.parse(block.startAt);
    const endMs = Date.parse(block.endAt);
    setDrag({
      blockId: block.id,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origStartMs: startMs,
      origEndMs: endMs,
      previewStartMs: startMs,
      previewEndMs: endMs,
      moved: false,
      offRail: false,
    });
  }

  function handlePressMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = dragRef.current;
    if (!current || windowStartMs === null || windowEndMs === null) return;
    const deltaX = event.clientX - current.startClientX;
    const deltaY = event.clientY - current.startClientY;
    const moved =
      current.moved ||
      Math.abs(deltaX) > DRAG_THRESHOLD_PX ||
      Math.abs(deltaY) > DRAG_THRESHOLD_PX;
    if (!moved) return;

    const deltaMs = (deltaY / PX_PER_MINUTE) * MINUTE_MS;
    let previewStartMs = current.origStartMs;
    let previewEndMs = current.origEndMs;
    let offRail = false;

    if (current.mode === "move") {
      const durationMs = current.origEndMs - current.origStartMs;
      const maxStartMs = Math.max(windowStartMs, windowEndMs - durationMs);
      previewStartMs = clamp(
        snapToSlot(current.origStartMs + deltaMs, windowStartMs),
        windowStartMs,
        maxStartMs,
      );
      previewEndMs = previewStartMs + durationMs;
      const rect = railRef.current?.getBoundingClientRect();
      offRail = rect
        ? event.clientX < rect.left - OFF_RAIL_PX ||
          event.clientX > rect.right + OFF_RAIL_PX
        : false;
    } else {
      previewEndMs = clamp(
        snapToSlot(current.origEndMs + deltaMs, windowStartMs),
        current.origStartMs + SNAP_MS,
        windowEndMs,
      );
    }

    setDrag({ ...current, moved, previewStartMs, previewEndMs, offRail });
  }

  function handlePressEnd() {
    const current = dragRef.current;
    if (!current) return;
    setDrag(null);
    const entry = placed.find((candidate) => candidate.block.id === current.blockId);
    if (!entry) return;
    if (!current.moved) {
      openPopover(entry);
      return;
    }
    if (current.mode === "move" && current.offRail) {
      commitDelete(current.blockId);
      return;
    }
    if (
      current.previewStartMs === current.origStartMs &&
      current.previewEndMs === current.origEndMs
    ) {
      return;
    }
    commitTimes(current.blockId, current.previewStartMs, current.previewEndMs);
  }

  function handlePressCancel() {
    setDrag(null);
  }

  function slotMinuteFromClientY(clientY: number): number {
    const rail = railRef.current;
    if (!rail) return 0;
    const rect = rail.getBoundingClientRect();
    const rawMinute = (clientY - rect.top) / PX_PER_MINUTE;
    const snapped = Math.round(rawMinute / SNAP_MINUTES) * SNAP_MINUTES;
    return clamp(snapped, 0, windowMinutes - SNAP_MINUTES);
  }

  function handleDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (windowStartMs === null) return;
    if (!event.dataTransfer.types.includes(ITEM_DRAG_MIME)) return;
    event.preventDefault();
    const slotMinute = slotMinuteFromClientY(event.clientY);
    setDropPreviewMinute((prev) => (prev === slotMinute ? prev : slotMinute));
  }

  function handleDragLeave(event: ReactDragEvent<HTMLDivElement>) {
    const rail = railRef.current;
    // dragleave also fires when crossing into children; only a true exit
    // clears the preview line.
    if (rail && event.relatedTarget instanceof Node && rail.contains(event.relatedTarget)) {
      return;
    }
    setDropPreviewMinute(null);
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    if (windowStartMs === null || windowEndMs === null) return;
    if (!event.dataTransfer.types.includes(ITEM_DRAG_MIME)) return;
    event.preventDefault();
    setDropPreviewMinute(null);

    const payload = parseItemDragPayload(event.dataTransfer.getData(ITEM_DRAG_MIME));
    if (!payload) {
      setActionError("Could not read the dropped task. Try dragging it again.");
      return;
    }

    const startMs = windowStartMs + slotMinuteFromClientY(event.clientY) * MINUTE_MS;
    const durationMinutes = Math.max(SNAP_MINUTES, Math.round(payload.durationMinutes));
    const endMs = Math.min(startMs + durationMinutes * MINUTE_MS, windowEndMs);

    setActionError(null);
    setPendingCreate({ startMs, endMs });
    startTransition(async () => {
      const result = await createBlockForItem({
        itemId: payload.itemId,
        startAtIso: new Date(startMs).toISOString(),
        endAtIso: new Date(endMs).toISOString(),
      });
      // The real block arrives via revalidated props; the ghost's job ends
      // with the round trip either way.
      setPendingCreate(null);
      if (result.error) setActionError(result.error);
    });
  }

  return (
    <div className="motion-day-rail flex flex-col gap-2 overflow-hidden rounded-xl bg-[var(--surface-subtle)] p-2">
      {actionError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
      ) : null}
      {allDayEvents.length > 0 ? (
        <div className="ml-10 flex flex-col gap-1">
          {allDayEvents.map((event) => (
            <div
              key={event.id}
              className="motion-all-day-event rounded bg-sky-200 px-2 py-1 text-xs font-medium text-sky-950 dark:bg-sky-900 dark:text-sky-100"
            >
              {event.title}, all day
            </div>
          ))}
        </div>
      ) : null}
      <div
        ref={railRef}
        className="relative min-w-0"
        style={{ height: railHeight }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hourMarks.map((hour) => {
          const top = (hour - wakeHour) * PX_PER_HOUR;
          return (
            <div
              key={hour}
              className="pointer-events-none absolute inset-x-0"
              style={{ top }}
            >
              <div
                className="absolute right-0 border-t border-zinc-200 dark:border-zinc-800"
                style={{ left: LABEL_GUTTER_PX }}
              />
              <span
                className="absolute -top-[7px] left-0 pr-2 text-right text-[10px] text-zinc-400"
                style={{ width: LABEL_GUTTER_PX }}
              >
                {hourLabel(hour)}
              </span>
            </div>
          );
        })}

        {placedEvents.map((entry) => (
          <div
            key={entry.event.id}
            className="motion-rail-event pointer-events-none absolute right-1 z-[5] overflow-hidden rounded-md bg-sky-200 px-2 pt-1 text-xs text-sky-950 dark:bg-sky-900 dark:text-sky-100"
            style={{
              top: entry.top,
              height: entry.height,
              left: LABEL_GUTTER_PX + 4,
            }}
          >
            <p className="truncate font-medium">{entry.event.title}</p>
          </div>
        ))}

        {placedHabits.map(({ habit, top }) => {
          const done = habitDoneById[habit.habitId] ?? habit.done;
          return (
            <button
              key={habit.id}
              type="button"
              data-done={done}
              aria-pressed={done}
              disabled={isPending}
              onClick={() => handleToggleHabit(habit)}
              className="today-rail-habit"
              style={{ top }}
            >
              <span className="today-rail-habit-check" aria-hidden="true">
                {done ? "✓" : ""}
              </span>
              <span className="today-rail-habit-name">{habit.name}</span>
              <span className="today-rail-habit-time">
                {habitTimeLabel(habit.scheduledTime)}
              </span>
            </button>
          );
        })}

        {placed.map((entry) => (
          <BlockCard
            key={entry.block.id}
            block={entry.block}
            top={entry.top}
            height={entry.height}
            indent={entry.indent}
            zIndex={entry.zIndex}
            highlighted={highlightId === entry.block.id}
            isDragging={
              drag !== null && drag.blockId === entry.block.id && drag.moved
            }
            isOffRail={
              drag !== null && drag.blockId === entry.block.id && drag.offRail
            }
            onPressStart={handlePressStart}
            onPressMove={handlePressMove}
            onPressEnd={handlePressEnd}
            onPressCancel={handlePressCancel}
            onOpen={openPopoverForBlock}
            onToggleLock={handleToggleLock}
          />
        ))}

        {pendingCreate !== null && windowStartMs !== null ? (
          <div
            className="motion-drop-pending absolute right-1 z-20 overflow-hidden rounded-md border border-dashed border-sky-400 bg-sky-50/60 px-2 pt-0.5 text-xs text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
            style={{
              top:
                ((pendingCreate.startMs - windowStartMs) / MINUTE_MS) *
                PX_PER_MINUTE,
              height: Math.max(
                ((pendingCreate.endMs - pendingCreate.startMs) / MINUTE_MS) *
                  PX_PER_MINUTE,
                12,
              ),
              left: LABEL_GUTTER_PX + 4,
            }}
          >
            Scheduling
          </div>
        ) : null}

        {dropPreviewMinute !== null ? (
          <div
            className="motion-drop-preview pointer-events-none absolute right-1 z-20 border-t-2 border-sky-400"
            style={{
              top: dropPreviewMinute * PX_PER_MINUTE,
              left: LABEL_GUTTER_PX,
            }}
          />
        ) : null}

        {nowTop !== null ? (
          <div
            className="motion-now-line pointer-events-none absolute right-0 z-20"
            style={{ top: nowTop, left: LABEL_GUTTER_PX }}
          >
            <div className="relative border-t-2 border-red-500">
              <div className="motion-now-dot absolute -top-[3px] -left-1 size-2 rounded-full bg-red-500" />
            </div>
          </div>
        ) : null}

        {popover !== null && popoverBlock !== null ? (
          <div
            ref={popoverRef}
            className="motion-block-popover absolute z-40"
            style={{ top: popover.top, left: popover.left }}
          >
            <BlockPopover
              block={popoverBlock}
              itemDueAt={popoverDueAt}
              onClose={() => setPopover(null)}
            />
          </div>
        ) : null}
      </div>
      {now !== null &&
      placed.length === 0 &&
      placedEvents.length === 0 &&
      allDayEvents.length === 0 &&
      placedHabits.length === 0 &&
      pendingCreate === null ? (
        <p className="motion-empty-state today-schedule-empty">
          Nothing scheduled today. Drag a task here.
        </p>
      ) : null}
    </div>
  );
}
