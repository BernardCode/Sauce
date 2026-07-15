"use client";

import type { TodayBlock } from "./types";

type Props = {
  blocks: TodayBlock[];
  wakeHour: number;
  sleepHour: number;
};

// Placeholder: the real rail lands on the rail branch.
export function DayRail({ blocks }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
      Schedule rail lands here. {blocks.length} blocks loaded.
    </div>
  );
}
