"use client";

import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import {
  TaskContextMenu,
  type TaskContextMenuHandle,
} from "@/app/components/task-context-menu";
import type { TodayItem } from "./item-list";
import { formatDue } from "./relative-time";

type Props = {
  item: TodayItem;
  now: Date | null;
  onDone: (id: string) => void;
};

export function ItemCard({ item, now, onDone }: Props) {
  const contextMenuRef = useRef<TaskContextMenuHandle | null>(null);
  const due = item.dueAt && now ? formatDue(new Date(item.dueAt), now) : null;
  const contextDetails = [
    item.course ?? (item.origin === "feed" ? "School feed" : null),
    due?.label,
    item.estMinutes ? `${item.estMinutes} minutes` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const hasMeta = Boolean(
    item.course ||
      item.origin === "feed" ||
      item.dueAt ||
      item.estMinutes ||
      item.optimistic,
  );

  function handleContextMenu(event: ReactMouseEvent<HTMLLIElement>) {
    if (
      (event.target as HTMLElement).matches(
        "input, textarea, select, [contenteditable='true']",
      )
    ) {
      return;
    }
    event.preventDefault();
    contextMenuRef.current?.openAt(event.clientX, event.clientY);
  }

  return (
    <li
      onContextMenu={handleContextMenu}
      data-saving={item.optimistic === true}
      className="today-task-row"
    >
      <input
        type="checkbox"
        checked={false}
        disabled={item.optimistic}
        onChange={() => onDone(item.id)}
        aria-label={
          item.optimistic
            ? `Saving "${item.title}"`
            : `Mark "${item.title}" done`
        }
        className="today-task-checkbox"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="today-task-title min-w-0 flex-1">{item.title}</span>
          {item.optimistic ? null : (
            <TaskContextMenu
              ref={contextMenuRef}
              title={item.title}
              details={contextDetails}
              dueAt={item.dueAt}
              scheduled={false}
              onComplete={() => onDone(item.id)}
            />
          )}
        </div>
        {hasMeta ? (
          <div className="today-task-meta">
            {item.course || item.origin === "feed" ? (
              <span>{item.course ?? "School feed"}</span>
            ) : null}
            {item.dueAt ? <span>{due?.label ?? " "}</span> : null}
            {item.estMinutes ? <span>{item.estMinutes}m</span> : null}
            {item.optimistic ? <span>Saving</span> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
