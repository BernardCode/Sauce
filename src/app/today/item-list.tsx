"use client";

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
  todayDate: string;
};

function dueTime(item: TodayItem): number {
  return item.dueAt ? new Date(item.dueAt).getTime() : Number.POSITIVE_INFINITY;
}

export function ItemList({ openItems, todayDate }: Props) {
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
        {sortedItems.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            now={now}
            onDone={handleDone}
          />
        ))}
        <QuickAdd onOptimisticAdd={handleOptimisticAdd} todayDate={todayDate} />
      </ul>
      {doneError ? <p className="today-list-error">{doneError}</p> : null}
    </section>
  );
}
