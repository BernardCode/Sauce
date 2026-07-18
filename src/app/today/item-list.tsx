"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setItemDone } from "./actions";
import { ItemCard } from "./item-card";
import { isSameLocalDay } from "./relative-time";
import { useNow } from "./use-now";

export type TodayItem = {
  id: string;
  title: string;
  course: string | null;
  dueAt: string | null;
  estMinutes: number | null;
  isProject: boolean;
  parentTitle: string | null;
};

type Props = {
  openItems: TodayItem[];
};

function dueTime(item: TodayItem): number {
  return item.dueAt ? new Date(item.dueAt).getTime() : Number.POSITIVE_INFINITY;
}

export function ItemList({ openItems }: Props) {
  const now = useNow();
  const [leaving, setLeaving] = useState<Record<string, true>>({});
  const [doneError, setDoneError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const topItems = openItems
    .filter((item) => {
      if (item.isProject || item.parentTitle === null) return true;
      return Boolean(
        now &&
          item.dueAt &&
          isSameLocalDay(new Date(item.dueAt), now),
      );
    })
    .sort((a, b) => dueTime(a) - dueTime(b))
    .slice(0, 10);

  function handleDone(id: string) {
    setDoneError(null);
    setLeaving((current) => ({ ...current, [id]: true }));
    startTransition(async () => {
      const result = await setItemDone({ id });
      if (result.error) {
        setLeaving((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        setDoneError(result.error);
      }
    });
  }

  if (!topItems.length) {
    return <p className="today-empty-state">No open tasks.</p>;
  }

  return (
    <section aria-label="Top tasks">
      <ul className="today-task-list">
        {topItems.map((item) =>
          item.isProject ? (
            <li key={item.id} className="today-task-row today-project-row">
              <span className="today-project-checkbox" aria-hidden="true" />
              <Link href={`/projects/${item.id}`} className="min-w-0 flex-1">
                <span className="today-task-title">{item.title}</span>
                <span className="today-task-meta">Project</span>
              </Link>
            </li>
          ) : (
            <ItemCard
              key={item.id}
              item={item}
              now={now}
              leaving={leaving[item.id] === true}
              onDone={handleDone}
            />
          ),
        )}
      </ul>
      {doneError ? <p className="today-list-error">{doneError}</p> : null}
    </section>
  );
}
