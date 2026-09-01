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
import { formatDue, formatDueDate } from "./relative-time";
import type { DropPosition } from "./reorder";
import { identifyTask } from "./task-identity";
import { TaskEditDialog } from "./task-edit-dialog";

type Props = {
  item: TodayItem;
  now: Date | null;
  onDone: (id: string) => void;
  reorder?: {
    disabled: boolean;
    isDragging: boolean;
    dropPosition: DropPosition | null;
    onDragStart: (event: DragEvent<HTMLLIElement>) => void;
    onDragEnd: () => void;
    onDragOver: (event: DragEvent<HTMLLIElement>) => void;
    onDrop: (event: DragEvent<HTMLLIElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLLIElement>) => void;
  };
  listDrag?: {
    disabled: boolean;
    isDragging: boolean;
    onDragStart: (event: DragEvent<HTMLLIElement>) => void;
    onDragEnd: () => void;
  };
  listAction?: {
    destination: "main" | "later";
    disabled: boolean;
    onMove: () => void;
  };
};

export function ItemCard({
  item,
  now,
  onDone,
  reorder,
  listDrag,
  listAction,
}: Props) {
  const contextMenuRef = useRef<TaskContextMenuHandle | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const title = item.title;
  const due = item.dueAt && now ? formatDue(new Date(item.dueAt), now) : null;
  const dueDate =
    item.dueAt && now ? formatDueDate(new Date(item.dueAt), now) : null;
  const identity = identifyTask(title, item.course);
  const contextDetails = [
    identity.label,
    due?.label,
    item.estMinutes ? `${item.estMinutes} minutes` : null,
  ]
    .filter(Boolean)
    .join(", ");
  function handleContextMenu(event: ReactMouseEvent<HTMLLIElement>) {
    if (item.optimistic) return;
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

  function handleDoubleClick(event: ReactMouseEvent<HTMLLIElement>) {
    if (
      item.optimistic ||
      (event.target as HTMLElement).closest(
        "button, a, input, textarea, select, [contenteditable='true']",
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
      onDoubleClick={handleDoubleClick}
      draggable={
        reorder || listDrag
          ? !(reorder?.disabled ?? listDrag?.disabled)
          : undefined
      }
      onDragStart={reorder?.onDragStart ?? listDrag?.onDragStart}
      onDragEnd={reorder?.onDragEnd ?? listDrag?.onDragEnd}
      onDragOver={reorder?.onDragOver}
      onDrop={reorder?.onDrop}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          contextMenuRef.current?.openAt(rect.left + rect.width * 0.6, rect.bottom);
          return;
        }
        reorder?.onKeyDown(event);
      }}
      tabIndex={item.optimistic ? undefined : 0}
      aria-haspopup={item.optimistic ? undefined : "menu"}
      aria-keyshortcuts={item.optimistic ? undefined : "Shift+F10"}
      title={item.optimistic ? undefined : "Double-click or right-click for task actions"}
      data-saving={item.optimistic === true}
      data-completing={isCompleting}
      data-dragging={reorder?.isDragging || listDrag?.isDragging || undefined}
      data-drop-position={reorder?.dropPosition ?? undefined}
      className={`today-task-row relative ${reorder ? "cursor-grab active:cursor-grabbing" : ""} ${reorder?.isDragging ? "opacity-45" : ""}`}
    >
      {reorder?.dropPosition ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-3 right-3 z-20 h-0.5 rounded-full bg-[var(--today-accent)] ${reorder.dropPosition === "before" ? "-top-[0.3rem]" : "-bottom-[0.3rem]"}`}
        />
      ) : null}
      <button
        type="button"
        role="checkbox"
        aria-checked={isCompleting}
        disabled={item.optimistic || isCompleting}
        onClick={completeTask}
        aria-label={
          item.optimistic
            ? `Saving "${title}"`
            : `Toggle completion for "${title}"`
        }
        data-checked={isCompleting}
        className="completion-check today-task-checkbox"
      >
        <span aria-hidden="true">✓</span>
      </button>
      <span
        className="today-task-class-emoji"
        aria-label={identity.label}
        title={identity.label}
      >
        {identity.emoji}
      </span>
      <div className="today-task-title-cell">
        <span className="today-task-title">{title}</span>
      </div>
      {item.optimistic ? null : (
        <TaskContextMenu
          ref={contextMenuRef}
          title={title}
          details={contextDetails}
          dueAt={item.dueAt}
          scheduled={false}
          onEdit={item.origin === "feed" ? undefined : () => setIsEditing(true)}
          onComplete={completeTask}
          listAction={
            listAction
              ? {
                  disabled: listAction.disabled,
                  label: `Move to ${listAction.destination === "later" ? "Later" : "Main"}`,
                  onMove: listAction.onMove,
                }
              : undefined
          }
        />
      )}
      <span
        className="today-task-due"
        data-tone={dueDate?.tone ?? "none"}
      >
        {dueDate?.label ?? (item.dueAt ? "" : "No date")}
      </span>
      <TaskEditDialog
        item={{ ...item, title }}
        open={isEditing}
        onClose={() => setIsEditing(false)}
      />
    </li>
  );
}
