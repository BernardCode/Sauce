"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { blockDomId, type TodayBlock } from "./types";

export type DragMode = "move" | "resize";

// "11:59pm" style clock reading, with the suffix optional so a range can
// say it once: "4:00 to 5:30pm".
function clockPart(date: Date, withSuffix: boolean): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const base = `${hours}:${String(minutes).padStart(2, "0")}`;
  return withSuffix ? `${base}${hours24 < 12 ? "am" : "pm"}` : base;
}

function rangeLabel(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const sameHalfOfDay = (start.getHours() < 12) === (end.getHours() < 12);
  return `${clockPart(start, !sameHalfOfDay)} to ${clockPart(end, true)}`;
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="7.5" width="9" height="6" rx="1.5" />
      {locked ? (
        <path d="M5.5 7.5v-2a2.5 2.5 0 0 1 5 0v2" />
      ) : (
        <path d="M5.5 7.5v-3a2.5 2.5 0 0 1 4.7-1.2" />
      )}
    </svg>
  );
}

type Props = {
  block: TodayBlock;
  top: number;
  height: number;
  // Horizontal nudge so overlapping blocks stay individually readable.
  indent: number;
  zIndex: number;
  highlighted: boolean;
  isDragging: boolean;
  // The live drag is far enough off the rail that release deletes.
  isOffRail: boolean;
  onPressStart: (
    event: ReactPointerEvent<HTMLDivElement>,
    block: TodayBlock,
    mode: DragMode,
  ) => void;
  onPressMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPressEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPressCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleLock: (block: TodayBlock) => void;
};

export function BlockCard({
  block,
  top,
  height,
  indent,
  zIndex,
  highlighted,
  isDragging,
  isOffRail,
  onPressStart,
  onPressMove,
  onPressEnd,
  onPressCancel,
  onToggleLock,
}: Props) {
  if (block.done) return null;

  const startMs = Date.parse(block.startAt);
  const endMs = Date.parse(block.endAt);

  // Item-less blocks ("bike to school") read as background noise next to
  // real scheduled work.
  const muted = block.itemId === null;
  const surface = muted
    ? "border-zinc-200 bg-white/70 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400"
    : "border-[var(--task-accent)] bg-[var(--task-soft)] text-[var(--task-ink)]";

  const classes = [
    "absolute overflow-hidden rounded-lg border shadow-sm select-none",
    surface,
    "touch-none cursor-grab active:cursor-grabbing",
    highlighted ? "ring-2 ring-sky-500" : "",
    isDragging ? "opacity-90 shadow-md" : "",
    isOffRail ? "border-dashed border-red-400 opacity-40 dark:border-red-500" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      id={blockDomId(block.id)}
      data-dragging={isDragging}
      data-off-rail={isOffRail}
      data-highlighted={highlighted}
      data-locked={block.locked}
      data-done={block.done}
      style={{ top, height, left: 44 + indent, right: 4, zIndex }}
      className={`motion-rail-block ${classes}`}
      onPointerDown={(event) => onPressStart(event, block, "move")}
      onPointerMove={onPressMove}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressCancel}
    >
      <div className="flex items-start justify-between gap-1 pt-0.5 pr-1 pl-2">
        <span className="min-w-0 truncate text-xs font-medium" title={block.title}>
          {block.title}
        </span>
        <button
          type="button"
          aria-label={block.locked ? `Unlock "${block.title}"` : `Lock "${block.title}"`}
          aria-pressed={block.locked}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLock(block);
          }}
          className={`motion-lock shrink-0 rounded p-0.5 ${
            block.locked
              ? "text-zinc-600 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <LockIcon locked={block.locked} />
        </button>
      </div>
      <p className="px-2 text-[10px] whitespace-nowrap tabular-nums text-zinc-500">
        {rangeLabel(startMs, endMs)}
      </p>
      <div
        aria-hidden="true"
        className="motion-resize-handle absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
        onPointerDown={(event) => {
          // Stop the card's move handler so this press only resizes.
          event.stopPropagation();
          onPressStart(event, block, "resize");
        }}
      />
    </div>
  );
}
