"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setItemDone } from "./actions";
import { ItemCard } from "./item-card";
import { updateOptimisticItems } from "./optimistic-items";
import { QuickAdd } from "./quick-add";
import type { TodayItem } from "./task-types";
import { useNow } from "./use-now";

export type { TodayItem } from "./task-types";

type Props = {
  openItems: TodayItem[];
};

function dueTime(item: TodayItem): number {
  return item.dueAt ? new Date(item.dueAt).getTime() : Number.POSITIVE_INFINITY;
}

export function ItemList({ openItems }: Props) {
  const now = useNow();
  const [doneError, setDoneError] = useState<string | null>(null);
  const [items, updateOptimistic] = useOptimistic(
    openItems,
    updateOptimisticItems,
  );
  const [, startTransition] = useTransition();

  const sortedItems = [...items].sort((a, b) => dueTime(a) - dueTime(b));

  function handleDone(id: string) {
    const completedItem = items.find((item) => item.id === id);
    if (!completedItem || completedItem.optimistic) return;

    setDoneError(null);
    startTransition(async () => {
      updateOptimistic({ type: "complete", id });
      const result = await setItemDone({ id });
      if (result.error) setDoneError(result.error);
    });
  }

  function handleOptimisticAdd(item: TodayItem) {
    updateOptimistic({ type: "add", item });
  }

  return (
    <section className="today-task-panel" aria-label="Tasks">
      <div className="today-task-list-header">
        <span className="today-task-list-label">Main</span>
        <span
          className="today-task-count"
          aria-label={`${sortedItems.length} open ${sortedItems.length === 1 ? "task" : "tasks"}`}
        >
          {sortedItems.length}
        </span>
      </div>
      <ul className="today-task-list">
        {sortedItems.map((item) =>
          item.isProject ? (
            <li
              key={item.id}
              className="today-task-row today-project-row"
              data-saving={item.optimistic === true}
            >
              <span className="today-project-checkbox" aria-hidden="true" />
              {item.optimistic ? (
                <div className="min-w-0 flex-1">
                  <span className="today-task-title">{item.title}</span>
                  <span className="today-task-meta">
                    <span>Saving project</span>
                  </span>
                </div>
              ) : (
                <Link href={`/projects/${item.id}`} className="min-w-0 flex-1">
                  <span className="today-task-title">{item.title}</span>
                  <span className="today-task-meta">
                    <span>Project</span>
                    {item.course ? <span>{item.course}</span> : null}
                  </span>
                </Link>
              )}
            </li>
          ) : (
            <ItemCard
              key={item.id}
              item={item}
              now={now}
              onDone={handleDone}
            />
          ),
        )}
        <QuickAdd onOptimisticAdd={handleOptimisticAdd} />
      </ul>
      {doneError ? <p className="today-list-error">{doneError}</p> : null}
    </section>
  );
}
