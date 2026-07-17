"use client";

import type { TodayBlock } from "./types";
import { useNow } from "./use-now";

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
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-medium">Up next</h2>
      {next && now ? (
        <div className="mt-2">
          <p className="font-medium">{next.title}</p>
          <p className="text-sm text-zinc-500">
            {countdownLabel(new Date(next.startAt), now)}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">Nothing scheduled.</p>
      )}
    </section>
  );
}
