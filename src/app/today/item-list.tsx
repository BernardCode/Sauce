"use client";

import { useState, useTransition } from "react";
import { setItemDone } from "./actions";
import { ItemCard } from "./item-card";
import { QuickAdd } from "./quick-add";
import { isSameLocalDay } from "./relative-time";
import type { TodayBlock } from "./types";
import { useNow } from "./use-now";

export type TodayItem = {
  id: string;
  title: string;
  course: string | null;
  dueAt: string | null;
  completedAt: string | null;
  estMinutes: number | null;
  remainingMinutes: number | null;
};

type Props = {
  openItems: TodayItem[];
  // Done within the last 48 hours; the client narrows this to the local day.
  doneItems: TodayItem[];
  // Blocks in the rail window; the scheduled badge and unscheduled flag on
  // the cards read these.
  blocks?: TodayBlock[];
};

// The badge points at the earliest live block still ahead of the clock. A
// block already underway (started, not ended) still counts: it is where the
// item lives right now. Null while the clock has not mounted, which renders
// the unscheduled state for one frame.
function findUpcomingBlock(
  blocks: TodayBlock[],
  itemId: string,
  now: Date | null,
): TodayBlock | null {
  if (!now) return null;
  let earliest: TodayBlock | null = null;
  for (const block of blocks) {
    if (block.itemId !== itemId || block.done) continue;
    if (new Date(block.endAt).getTime() <= now.getTime()) continue;
    if (
      earliest === null ||
      new Date(block.startAt).getTime() < new Date(earliest.startAt).getTime()
    ) {
      earliest = block;
    }
  }
  return earliest;
}

export function ItemList({ openItems, doneItems, blocks = [] }: Props) {
  // Null through the server render and the first client frame so hydration
  // matches, then the shared clock keeps relative labels fresh.
  const now = useNow();
  const [leaving, setLeaving] = useState<Record<string, true>>({});
  const [doneError, setDoneError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dueItems = openItems
    .filter((item) => item.dueAt !== null)
    .sort(
      (a, b) =>
        new Date(a.dueAt as string).getTime() -
        new Date(b.dueAt as string).getTime(),
    );
  const somedayItems = openItems.filter((item) => item.dueAt === null);

  // Grouping by the browser's day, not the server's, is the point: "today"
  // means the day the person looking at the screen is living in.
  const doneToday = now
    ? doneItems.filter(
        (item) =>
          item.completedAt !== null &&
          isSameLocalDay(new Date(item.completedAt), now),
      )
    : [];

  function handleDone(id: string) {
    setDoneError(null);
    // Marked as leaving right away so the card starts fading while the
    // server action is still in flight.
    setLeaving((prev) => ({ ...prev, [id]: true }));
    startTransition(async () => {
      const result = await setItemDone({ id });
      if (result.error) {
        setLeaving((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setDoneError(result.error);
      }
    });
  }

  const isEmpty = openItems.length === 0 && doneItems.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-5 pt-6">
      <QuickAdd />

      {doneError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{doneError}</p>
      ) : null}

      {isEmpty ? (
        <p className="flex flex-1 items-center justify-center text-zinc-500">
          Nothing here yet. Add a task above.
        </p>
      ) : (
        <>
          {dueItems.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {dueItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  now={now}
                  leaving={leaving[item.id] === true}
                  onDone={handleDone}
                  upcomingBlock={findUpcomingBlock(blocks, item.id, now)}
                />
              ))}
            </ul>
          ) : somedayItems.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing open. Add a task above.</p>
          ) : null}

          {somedayItems.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm text-zinc-500 select-none">
                Someday ({somedayItems.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {somedayItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    now={now}
                    leaving={leaving[item.id] === true}
                    onDone={handleDone}
                    upcomingBlock={findUpcomingBlock(blocks, item.id, now)}
                  />
                ))}
              </ul>
            </details>
          ) : null}

          {doneToday.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm text-zinc-500 select-none">
                Done today ({doneToday.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1 pl-1">
                {doneToday.map((item) => (
                  <li
                    key={item.id}
                    className="text-sm text-zinc-400 line-through dark:text-zinc-600"
                  >
                    {item.title}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
