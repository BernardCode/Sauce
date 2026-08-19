"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  TaskContextMenu,
  type TaskContextMenuHandle,
} from "@/app/components/task-context-menu";
import type { TodayItem } from "./item-list";
import { formatDue } from "./relative-time";
import { TaskEditDialog } from "./task-edit-dialog";

type Props = {
  item: TodayItem;
  now: Date | null;
  onDone: (id: string) => void;
  reorder?: {
    disabled: boolean;
    isDragging: boolean;
    isDropTarget: boolean;
    onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
    onDragEnd: () => void;
    onDragOver: (event: DragEvent<HTMLLIElement>) => void;
    onDrop: (event: DragEvent<HTMLLIElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  };
};

export function ItemCard({ item, now, onDone, reorder }: Props) {
  const contextMenuRef = useRef<TaskContextMenuHandle | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  function completeTask() {
    if (item.optimistic || isCompleting) return;
    setIsCompleting(true);
    completionTimerRef.current = setTimeout(() => {
      onDone(item.id);
      resetTimerRef.current = setTimeout(() => setIsCompleting(false), 1200);
    }, 240);
  }

  useEffect(() => {
    return () => {
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  return (
    <li
      onContextMenu={handleContextMenu}
      onDragOver={reorder?.onDragOver}
      onDrop={reorder?.onDrop}
      data-saving={item.optimistic === true}
      data-completing={isCompleting}
      data-dragging={reorder?.isDragging || undefined}
      className={`today-task-row ${reorder?.isDragging ? "opacity-45" : ""} ${reorder?.isDropTarget ? "outline outline-2 outline-offset-1 outline-[var(--today-accent)]" : ""}`}
    >
      {reorder ? (
        <button
          type="button"
          draggable={!reorder.disabled}
          disabled={reorder.disabled}
          onDragStart={reorder.onDragStart}
          onDragEnd={reorder.onDragEnd}
          onKeyDown={reorder.onKeyDown}
          aria-label={`Reorder "${item.title}"`}
          className="-ml-1 mt-0.5 grid size-5 shrink-0 cursor-grab place-items-center rounded text-[var(--muted)] opacity-60 transition hover:bg-[var(--surface-subtle)] hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing disabled:cursor-default disabled:opacity-25"
        >
          <span
            aria-hidden="true"
            className="block size-3"
            style={{
              backgroundImage:
                "radial-gradient(circle, currentColor 1px, transparent 1.5px)",
              backgroundSize: "4px 4px",
            }}
          />
        </button>
      ) : null}
      <button
        type="button"
        role="checkbox"
        aria-checked={isCompleting}
        disabled={item.optimistic || isCompleting}
        onClick={completeTask}
        aria-label={
          item.optimistic
            ? `Saving "${item.title}"`
            : `Toggle completion for "${item.title}"`
        }
        data-checked={isCompleting}
        className="completion-check today-task-checkbox"
      >
        <span aria-hidden="true">✓</span>
      </button>
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
              onEdit={item.origin === "feed" ? undefined : () => setIsEditing(true)}
              onComplete={completeTask}
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
      <TaskEditDialog
        item={item}
        open={isEditing}
        onClose={() => setIsEditing(false)}
      />
    </li>
  );
}
