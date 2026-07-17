"use client";

import type { TodayBlock } from "./types";
import { useNow } from "./use-now";
import { ArrowRight, Clock3 } from "lucide-react";

function countdownLabel(target: Date, now: Date): string {
  const minutes = Math.ceil((target.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "Now";
  if (minutes < 60) return `In ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `In ${hours}h ${remainder}m` : `In ${hours}h`;
}

export function UpNext({ blocks }: { blocks: TodayBlock[] }) {
  const now = useNow();
  const next = now
    ? blocks
        .filter((block) => !block.done && new Date(block.endAt) > now)
        .sort(
          (a, b) =>
            new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        )[0]
    : null;
  return (
    <section className="motion-up-next relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white shadow-lg shadow-indigo-500/15 dark:border-indigo-800">
      <div className="motion-up-next-orb absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-100"><Clock3 className="motion-clock" size={15} /> Up next</div>
      {next && now ? (
        <div className="relative mt-4">
          <p className="text-lg font-semibold tracking-[-0.02em]">{next.title}</p>
          <p className="mt-1 text-sm text-indigo-100">
            {countdownLabel(new Date(next.startAt), now)}
          </p>
          <div className="motion-forward mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-xs font-medium">Open schedule <ArrowRight size={13} /></div>
        </div>
      ) : (
        <div className="relative mt-4"><p className="font-medium">Your time is open.</p><p className="mt-1 text-sm text-indigo-100">Drag a task onto the schedule when you are ready.</p></div>
      )}
    </section>
  );
}
