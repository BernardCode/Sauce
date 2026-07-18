"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setItemDone } from "./actions";
import { ItemCard } from "./item-card";
import { QuickAdd } from "./quick-add";
import { useNow } from "./use-now";

export type TodayItem = {
  id: string;
  title: string;
  course: string | null;
  dueAt: string | null;
  estMinutes: number | null;
  isProject: boolean;
  origin: string;
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
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sortedItems = [...openItems].sort((a, b) => dueTime(a) - dueTime(b));

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

  return (
    <section className="today-task-panel" aria-label="Tasks">
      <ul className="today-task-list">
        {sortedItems.map((item) =>
          item.isProject ? (
            <li key={item.id} className="today-task-row today-project-row">
              <span className="today-project-checkbox" aria-hidden="true" />
              <Link href={`/projects/${item.id}`} className="min-w-0 flex-1">
                <span className="today-task-title">{item.title}</span>
                <span className="today-task-meta">
                  <span>Project</span>
                  {item.course ? <span>{item.course}</span> : null}
                </span>
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
        {pendingTitle ? (
          <li className="today-task-row today-task-pending" aria-live="polite">
            <span className="today-project-checkbox" aria-hidden="true" />
            <span className="today-task-title">{pendingTitle}</span>
          </li>
        ) : null}
        <li className="today-task-add-row">
          <QuickAdd onPendingChange={setPendingTitle} />
        </li>
      </ul>
      {doneError ? <p className="today-list-error">{doneError}</p> : null}
    </section>
  );
}
