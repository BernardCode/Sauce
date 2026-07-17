"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { updateItemEstimate } from "./actions";
import type { TodayItem } from "./item-list";
import { formatDue, isSameLocalDay, type DueTone } from "./relative-time";
import {
  BLOCK_HIGHLIGHT_EVENT,
  ITEM_DRAG_MIME,
  blockDomId,
  type BlockHighlightDetail,
  type ItemDragPayload,
  type TodayBlock,
} from "./types";

const toneClass: Record<DueTone, string> = {
  overdue: "text-red-600 dark:text-red-400",
  soon: "text-amber-600 dark:text-amber-400",
  normal: "text-zinc-500",
};

// A fixed palette hashed by course name, so the same course always wears
// the same color without anyone configuring anything.
const pillPalettes = [
  "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
];

function ItemTag({ label }: { label: string }) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  const palette = pillPalettes[Math.abs(hash) % pillPalettes.length];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${palette}`}>
      {label}
    </span>
  );
}

// "today, 4:00" per the spec: the day in words, then a bare 12-hour clock
// time in browser local time. The rail sits alongside, so the short form
// reads fine.
function formatBlockStart(start: Date, now: Date): string {
  const hours24 = start.getHours();
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const time = `${hours}:${String(start.getMinutes()).padStart(2, "0")}`;
  if (isSameLocalDay(start, now)) return `today, ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameLocalDay(start, tomorrow)) return `tomorrow, ${time}`;
  const weekday = start.toLocaleDateString(undefined, { weekday: "short" });
  return `${weekday}, ${time}`;
}

function sendHighlight(blockId: string, on: boolean) {
  window.dispatchEvent(
    new CustomEvent(BLOCK_HIGHLIGHT_EVENT, {
      detail: { blockId, on } satisfies BlockHighlightDetail,
    }),
  );
}

// Read-only pointer at the rail. Hover lights the matching block up over
// there, click scrolls to it. Time editing lives on the schedule, never here.
function ScheduleBadge({ block, now }: { block: TodayBlock; now: Date }) {
  const hoveredRef = useRef(false);

  // If the card disappears mid-hover (checked done, list refiltered), the
  // rail should not stay lit.
  useEffect(() => {
    return () => {
      if (hoveredRef.current) sendHighlight(block.id, false);
    };
  }, [block.id]);

  return (
    <button
      type="button"
      title="Show on the schedule"
      onMouseEnter={() => {
        hoveredRef.current = true;
        sendHighlight(block.id, true);
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
        sendHighlight(block.id, false);
      }}
      onClick={() => {
        document
          .getElementById(blockDomId(block.id))
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
      className="inline-flex shrink-0 items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.75V8l2.25 1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {formatBlockStart(new Date(block.startAt), now)}
    </button>
  );
}

// Muted "45m" (or "+ est" when unset) that turns into a small number input.
// Enter or blur saves, Escape cancels, empty saves null.
function EstimateEditor({ item }: { item: TodayItem }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Shows the new estimate immediately and falls back to the server value
  // on its own once the save round-trip settles.
  const [optimisticEst, setOptimisticEst] = useOptimistic(item.estMinutes);
  const [, startTransition] = useTransition();

  function open() {
    setDraft(optimisticEst === null ? "" : String(optimisticEst));
    setError(null);
    setEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    let next: number | null = null;
    if (trimmed !== "") {
      const minutes = Number(trimmed);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
        setError("Whole minutes, 1 to 600.");
        return;
      }
      next = minutes;
    }
    setEditing(false);
    setError(null);
    if (next === item.estMinutes) return;
    startTransition(async () => {
      setOptimisticEst(next);
      const result = await updateItemEstimate({ id: item.id, estMinutes: next });
      if (result.error) {
        setError(result.error);
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      setEditing(false);
      setError(null);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {editing ? (
        <input
          type="number"
          min={1}
          max={600}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          autoFocus
          aria-label="Estimated minutes"
          className="w-14 rounded border border-zinc-300 bg-transparent px-1 text-xs text-zinc-700 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:focus:border-zinc-500"
        />
      ) : (
        <button
          type="button"
          onClick={open}
          aria-label={
            optimisticEst === null
              ? `Add an estimate for "${item.title}"`
              : `Change the estimate for "${item.title}"`
          }
          className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
        >
          {optimisticEst === null ? "+ est" : `${optimisticEst}m`}
        </button>
      )}
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </span>
  );
}

type Props = {
  item: TodayItem;
  // Null until the client mounts, so due labels never hydrate mismatched.
  now: Date | null;
  leaving: boolean;
  onDone: (id: string) => void;
  // Earliest live block still ahead of the clock; null means unscheduled.
  upcomingBlock: TodayBlock | null;
};

export function ItemCard({ item, now, leaving, onDone, upcomingBlock }: Props) {
  const due = item.dueAt && now ? formatDue(new Date(item.dueAt), now) : null;

  // Someday items skip the unscheduled flag on purpose: an undated wish
  // being unscheduled is not news.
  const flagUnscheduled = upcomingBlock === null && item.dueAt !== null;

  function handleDragStart(event: DragEvent<HTMLLIElement>) {
    // Default to an hour when nothing is known, and clamp so a stray
    // estimate cannot drop a sliver or an all-day slab onto the rail.
    const durationMinutes = Math.min(
      240,
      Math.max(15, item.remainingMinutes ?? item.estMinutes ?? 60),
    );
    event.dataTransfer.setData(
      ITEM_DRAG_MIME,
      JSON.stringify({ itemId: item.id, durationMinutes } satisfies ItemDragPayload),
    );
    event.dataTransfer.effectAllowed = "copy";
  }

  return (
    <li
      draggable={!leaving}
      onDragStart={handleDragStart}
      data-leaving={leaving}
      data-unscheduled={flagUnscheduled}
      className={`motion-item-card group flex cursor-grab items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3.5 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-[var(--surface)] hover:shadow-md active:cursor-grabbing dark:hover:border-indigo-800 ${
        flagUnscheduled ? "border-l-[3px] border-l-amber-400" : ""
      } ${leaving ? "translate-x-2 opacity-0" : "opacity-100"}`}
    >
      <input
        type="checkbox"
        checked={leaving}
        disabled={leaving}
        onChange={() => onDone(item.id)}
        aria-label={`Mark "${item.title}" done`}
        className="mt-1 size-[18px] shrink-0 cursor-pointer rounded-md accent-[var(--primary)]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-[-0.01em]">{item.title}</span>
          <ItemTag label={item.parentTitle ?? item.course ?? "Manual"} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {item.dueAt ? (
            // Non-breaking space holds the line height for the single frame
            // before the mounted clock exists.
            <span className={`text-xs ${due ? toneClass[due.tone] : "text-zinc-500"}`}>
              {due?.label ?? " "}
            </span>
          ) : null}
          {upcomingBlock && now ? (
            <ScheduleBadge block={upcomingBlock} now={now} />
          ) : flagUnscheduled ? (
            <span className="shrink-0 rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              unscheduled
            </span>
          ) : null}
          <EstimateEditor item={item} />
        </div>
      </div>
    </li>
  );
}
