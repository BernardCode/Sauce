"use client";

import {
  useEffect,
  useOptimistic,
  useState,
  useTransition,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { setItemDone } from "./actions";
import { ItemCard } from "./item-card";
import { updateOptimisticItems } from "./optimistic-items";
import { QuickAdd } from "./quick-add";
import {
  loadTodayTaskOrder,
  reorderTodayTasks,
} from "./reorder-actions";
import { reorderItemIds, type DropPosition } from "./reorder";
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
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: DropPosition;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [items, updateOptimistic] = useOptimistic(
    openItems,
    updateOptimisticItems,
  );
  const [isPending, startTransition] = useTransition();

  const fallbackItems = [...items].sort((a, b) => dueTime(a) - dueTime(b));
  const persistentItemIds = fallbackItems
    .filter((item) => !item.optimistic)
    .map((item) => item.id);
  const persistentItemIdsKey = persistentItemIds.join(",");
  const orderById = new Map(orderedIds.map((id, index) => [id, index]));
  const fallbackById = new Map(
    fallbackItems.map((item, index) => [item.id, index]),
  );
  const sortedItems = [...fallbackItems].sort((a, b) => {
    const aOrder = orderById.get(a.id);
    const bOrder = orderById.get(b.id);
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    return (fallbackById.get(a.id) ?? 0) - (fallbackById.get(b.id) ?? 0);
  });
  const visiblePersistentIds = sortedItems
    .filter((item) => !item.optimistic)
    .map((item) => item.id);

  useEffect(() => {
    const itemIds = persistentItemIdsKey
      ? persistentItemIdsKey.split(",")
      : [];
    if (itemIds.length === 0) return;

    let ignoreResult = false;
    startTransition(async () => {
      const result = await loadTodayTaskOrder({ itemIds });
      if (ignoreResult) return;
      setOrderedIds(result.orderedItemIds);
      setReorderError(result.error);
    });
    return () => {
      ignoreResult = true;
    };
  }, [persistentItemIdsKey]);

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

  function saveOrder(nextIds: string[], movedId: string, movedTitle: string) {
    const previousIds = visiblePersistentIds;
    setOrderedIds(nextIds);
    setReorderError(null);
    setAnnouncement(
      `${movedTitle} moved to position ${nextIds.indexOf(movedId) + 1} of ${nextIds.length}.`,
    );
    startTransition(async () => {
      const result = await reorderTodayTasks({ orderedItemIds: nextIds });
      if (result.error) {
        setOrderedIds(previousIds);
        setReorderError(result.error);
      }
    });
  }

  function moveItem(
    itemId: string,
    targetId: string,
    position: DropPosition,
  ) {
    const nextIds = reorderItemIds(
      visiblePersistentIds,
      itemId,
      targetId,
      position,
    );
    if (
      nextIds.length === visiblePersistentIds.length &&
      nextIds.every((id, index) => id === visiblePersistentIds[index])
    ) {
      return;
    }
    const movedItem = items.find((item) => item.id === itemId);
    saveOrder(nextIds, itemId, movedItem?.title ?? "Task");
  }

  function handleDragStart(
    event: DragEvent<HTMLLIElement>,
    itemId: string,
  ) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = Math.max(
      0,
      Math.min(bounds.width, event.clientX - bounds.left),
    );
    const offsetY = Math.max(
      0,
      Math.min(bounds.height, event.clientY - bounds.top),
    );
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.setDragImage(event.currentTarget, offsetX, offsetY);
    setDraggedId(itemId);
    setDropTarget(null);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    const position =
      event.clientY >= bounds.top + bounds.height / 2 ? "after" : "before";
    setDropTarget((current) =>
      current?.id === targetId && current.position === position
        ? current
        : { id: targetId, position },
    );
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, targetId: string) {
    event.preventDefault();
    if (draggedId) {
      moveItem(
        draggedId,
        targetId,
        dropTarget?.id === targetId ? dropTarget.position : "before",
      );
    }
    setDraggedId(null);
    setDropTarget(null);
  }

  function handleReorderKeyDown(
    event: KeyboardEvent<HTMLLIElement>,
    itemId: string,
  ) {
    const currentIndex = visiblePersistentIds.indexOf(itemId);
    if (currentIndex === -1) return;

    let targetId: string | undefined;
    let position: DropPosition = "before";
    if (event.key === "ArrowUp" && currentIndex > 0) {
      targetId = visiblePersistentIds[currentIndex - 1];
    } else if (
      event.key === "ArrowDown" &&
      currentIndex < visiblePersistentIds.length - 1
    ) {
      targetId = visiblePersistentIds[currentIndex + 1];
      position = "after";
    } else if (event.key === "Home" && currentIndex > 0) {
      targetId = visiblePersistentIds[0];
    } else if (
      event.key === "End" &&
      currentIndex < visiblePersistentIds.length - 1
    ) {
      targetId = visiblePersistentIds[visiblePersistentIds.length - 1];
      position = "after";
    }

    if (!targetId) return;
    event.preventDefault();
    moveItem(itemId, targetId, position);
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
            reorder={
              item.optimistic
                ? undefined
                : {
                    disabled: isPending,
                    isDragging: draggedId === item.id,
                    dropPosition:
                      dropTarget?.id === item.id
                        ? dropTarget.position
                        : null,
                    onDragStart: (event) => handleDragStart(event, item.id),
                    onDragEnd: () => {
                      setDraggedId(null);
                      setDropTarget(null);
                    },
                    onDragOver: (event) => handleDragOver(event, item.id),
                    onDrop: (event) => handleDrop(event, item.id),
                    onKeyDown: (event) =>
                      handleReorderKeyDown(event, item.id),
                  }
            }
          />
        ))}
        <QuickAdd onOptimisticAdd={handleOptimisticAdd} todayDate={todayDate} />
      </ul>
      {doneError || reorderError ? (
        <p className="today-list-error">{doneError ?? reorderError}</p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
