"use client";

import { DoNowCounter } from "./do-now-counter";
import { formatDue } from "./relative-time";
import { formatScheduleTitle } from "./schedule-title";
import type { TodayBlock } from "./types";
import { useNow } from "./use-now";

type Props = {
  block: TodayBlock;
  itemDueAt: string | null;
  onClose: () => void;
};

// The panel the rail shows when a block is clicked: the item's due date,
// the planner's reason when one exists, and the elapsed-work counter.
export function BlockPopover({ block, itemDueAt, onClose }: Props) {
  const now = useNow();
  const due = itemDueAt && now ? formatDue(new Date(itemDueAt), now) : null;

  return (
    <div className="w-64 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">
          {formatScheduleTitle(block.title)}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Close
        </button>
      </div>
      {due ? <p className="mt-1 text-xs text-zinc-500">{due.label}</p> : null}
      {block.reason ? (
        <p className="mt-1 text-xs text-zinc-500">Why: {block.reason}</p>
      ) : null}
      {block.done ? (
        <p className="mt-1 text-xs text-zinc-500">Done.</p>
      ) : (
        <div className="mt-3">
          <DoNowCounter blockId={block.id} />
        </div>
      )}
    </div>
  );
}
