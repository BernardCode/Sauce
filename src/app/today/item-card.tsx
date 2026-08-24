"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
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
import { renameItem } from "./rename-item-action";
import type { DropPosition } from "./reorder";
import { TaskEditDialog } from "./task-edit-dialog";

type Props = {
  item: TodayItem;
  now: Date | null;
  onDone: (id: string) => void;
  reorder?: {
    disabled: boolean;
    isDragging: boolean;
    dropPosition: DropPosition | null;
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
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const cancelRenameRef = useRef(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [title, setOptimisticTitle] = useOptimistic(item.title);
  const [isRenaming, startRenameTransition] = useTransition();
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
      item.optimistic ||
      isRenaming,
  );
  const canRename = !item.optimistic && item.origin !== "feed";

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

  function beginRenaming() {
    if (!canRename || isRenaming) return;
    cancelRenameRef.current = false;
    setRenameError(null);
    setTitleDraft(title);
    setIsEditingTitle(true);
  }

  function commitTitle() {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    if (!isEditingTitle) return;
    const nextTitle = titleDraft.trim();
    setIsEditingTitle(false);

    if (!nextTitle) {
      setTitleDraft(title);
      setRenameError("A task needs a title.");
      return;
    }
    if (nextTitle === title) return;

    setRenameError(null);
    startRenameTransition(async () => {
      setOptimisticTitle(nextTitle);
      const result = await renameItem({
        id: item.id,
        title: nextTitle,
      });
      setRenameError(result.error);
    });
  }

  useEffect(() => {
    return () => {
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isEditingTitle) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [isEditingTitle]);

  return (
    <li
      onContextMenu={handleContextMenu}
      onDragOver={reorder?.onDragOver}
      onDrop={reorder?.onDrop}
      data-saving={item.optimistic === true}
      data-completing={isCompleting}
      data-dragging={reorder?.isDragging || undefined}
      data-drop-position={reorder?.dropPosition ?? undefined}
      className={`today-task-row relative ${reorder?.isDragging ? "opacity-45" : ""}`}
    >
      {reorder?.dropPosition ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-3 right-3 z-20 h-0.5 rounded-full bg-[var(--today-accent)] ${reorder.dropPosition === "before" ? "-top-[0.3rem]" : "-bottom-[0.3rem]"}`}
        />
      ) : null}
      {reorder ? (
        <button
          type="button"
          draggable={!reorder.disabled && !isEditingTitle}
          disabled={reorder.disabled || isEditingTitle}
          onDragStart={reorder.onDragStart}
          onDragEnd={reorder.onDragEnd}
          onKeyDown={reorder.onKeyDown}
          aria-label={`Move "${title}"`}
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
            ? `Saving "${title}"`
            : `Toggle completion for "${title}"`
        }
        data-checked={isCompleting}
        className="completion-check today-task-checkbox"
      >
        <span aria-hidden="true">✓</span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {isEditingTitle ? (
            <input
              ref={renameInputRef}
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelRenameRef.current = true;
                  setTitleDraft(title);
                  setIsEditingTitle(false);
                }
              }}
              aria-label="Task title"
              maxLength={500}
              className="today-task-title min-w-0 flex-1 border-0 border-b border-[var(--line-strong)] bg-transparent p-0 outline-none focus:border-[var(--primary)]"
            />
          ) : (
            <span
              onDoubleClick={beginRenaming}
              className={`today-task-title min-w-0 flex-1 ${canRename ? "cursor-text" : ""}`}
            >
              {title}
            </span>
          )}
          {item.optimistic ? null : (
            <TaskContextMenu
              ref={contextMenuRef}
              title={title}
              details={contextDetails}
              dueAt={item.dueAt}
              scheduled={false}
              onEdit={item.origin === "feed" ? undefined : () => setIsEditing(true)}
              onComplete={completeTask}
            />
          )}
        </div>
        {renameError ? (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {renameError}
          </p>
        ) : null}
        {hasMeta ? (
          <div className="today-task-meta">
            {item.course || item.origin === "feed" ? (
              <span>{item.course ?? "School feed"}</span>
            ) : null}
            {item.dueAt ? <span>{due?.label ?? " "}</span> : null}
            {item.estMinutes ? <span>{item.estMinutes}m</span> : null}
            {item.optimistic ? <span>Saving</span> : null}
            {isRenaming ? <span>Saving</span> : null}
          </div>
        ) : null}
      </div>
      <TaskEditDialog
        item={{ ...item, title }}
        open={isEditing}
        onClose={() => setIsEditing(false)}
      />
    </li>
  );
}
