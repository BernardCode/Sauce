"use client";

import {
  useEffect,
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
import { updateItemField } from "./actions";
import type { TodayItem } from "./item-list";
import { formatDue, formatDueDate } from "./relative-time";
import type { DropPosition } from "./reorder";
import { dateInputValue, endOfDate } from "./task-edit-values";
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
  const dueDateInputRef = useRef<HTMLInputElement | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(item.title);
  const [displayCourse, setDisplayCourse] = useState(item.course);
  const [displayDueAt, setDisplayDueAt] = useState(item.dueAt);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [dueDateDraft, setDueDateDraft] = useState(
    dateInputValue(item.dueAt),
  );
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, startEditTransition] = useTransition();
  const due =
    displayDueAt && now ? formatDue(new Date(displayDueAt), now) : null;
  const dueDate =
    displayDueAt && now
      ? formatDueDate(new Date(displayDueAt), now)
      : null;
  const identity = identifyTask(displayTitle, displayCourse);
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

  function openTitleEditor() {
    if (item.optimistic || isSavingEdit) return;
    setEditError(null);
    setTitleDraft(displayTitle);
    setIsEditingDueDate(false);
    setIsEditingTitle(true);
  }

  function saveTitle() {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setEditError("A task needs a title.");
      return;
    }
    if (nextTitle === displayTitle) {
      setIsEditingTitle(false);
      return;
    }

    const previousTitle = displayTitle;
    setDisplayTitle(nextTitle);
    setIsEditingTitle(false);
    setEditError(null);
    startEditTransition(async () => {
      const result = await updateItemField({
        id: item.id,
        field: "title",
        value: nextTitle,
      });
      if (result.error) {
        setDisplayTitle(previousTitle);
        setTitleDraft(nextTitle);
        setIsEditingTitle(true);
        setEditError(result.error);
      }
    });
  }

  function openDueDateEditor() {
    if (item.optimistic || isSavingEdit) return;
    setEditError(null);
    setDueDateDraft(dateInputValue(displayDueAt));
    setIsEditingTitle(false);
    setIsEditingDueDate(true);
  }

  function saveDueDate(value: string) {
    const nextDueAt = endOfDate(value);
    const previousDueAt = displayDueAt;
    if (nextDueAt === previousDueAt) {
      setIsEditingDueDate(false);
      return;
    }

    setDisplayDueAt(nextDueAt);
    setIsEditingDueDate(false);
    setEditError(null);
    startEditTransition(async () => {
      const result = await updateItemField({
        id: item.id,
        field: "dueAt",
        value: nextDueAt,
      });
      if (result.error) {
        setDisplayDueAt(previousDueAt);
        setDueDateDraft(value);
        setIsEditingDueDate(true);
        setEditError(result.error);
      }
    });
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
    if (!isEditingDueDate) return;
    try {
      dueDateInputRef.current?.showPicker();
    } catch {
      dueDateInputRef.current?.focus();
    }
  }, [isEditingDueDate]);

  useEffect(() => {
    return () => {
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  return (
    <li
      onContextMenu={handleContextMenu}
      draggable={
        reorder || listDrag
          ? !isEditingTitle &&
            !isEditingDueDate &&
            !isSavingEdit &&
            !(reorder?.disabled ?? listDrag?.disabled)
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
      title={
        editError ??
        (item.optimistic
          ? undefined
          : "Double-click the title or due date to edit. Right-click for task actions.")
      }
      data-saving={item.optimistic === true}
      data-editing={isEditingTitle || isEditingDueDate || undefined}
      data-edit-error={editError !== null || undefined}
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
            ? `Saving "${displayTitle}"`
            : `Toggle completion for "${displayTitle}"`
        }
        data-checked={isCompleting}
        className="completion-check today-task-checkbox"
      >
        <span aria-hidden="true">✓</span>
      </button>
      <span
        className="today-task-class-emoji"
        aria-hidden={!identity.emoji || undefined}
        aria-label={identity.label || undefined}
        title={identity.label || undefined}
      >
        {identity.emoji}
      </span>
      <div className="today-task-title-cell">
        {isEditingTitle ? (
          <input
            type="text"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.currentTarget.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setTitleDraft(displayTitle);
                setIsEditingTitle(false);
                setEditError(null);
              }
            }}
            aria-label={`Edit title for ${displayTitle}`}
            aria-invalid={editError !== null}
            maxLength={500}
            autoFocus
            className="today-task-title-input"
          />
        ) : (
          <button
            type="button"
            className="today-task-title"
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openTitleEditor();
            }}
            onKeyDown={(event) => {
              if (event.key === "F2") {
                event.preventDefault();
                openTitleEditor();
              }
            }}
            aria-label={`${displayTitle}. Double-click or press F2 to edit the title.`}
          >
            {displayTitle}
          </button>
        )}
      </div>
      {item.optimistic ? null : (
        <TaskContextMenu
          ref={contextMenuRef}
          title={displayTitle}
          details={contextDetails}
          dueAt={displayDueAt}
          scheduled={false}
          onEdit={() => setIsEditing(true)}
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
      {isEditingDueDate ? (
        <input
          ref={dueDateInputRef}
          type="date"
          value={dueDateDraft}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setDueDateDraft(value);
            saveDueDate(value);
          }}
          onBlur={() => {
            if (isEditingDueDate) setIsEditingDueDate(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setDueDateDraft(dateInputValue(displayDueAt));
              setIsEditingDueDate(false);
              setEditError(null);
            }
          }}
          aria-label={`Edit due date for ${displayTitle}`}
          aria-invalid={editError !== null}
          autoFocus
          className="today-task-due-input"
        />
      ) : (
        <button
          type="button"
          className="today-task-due"
          data-tone={dueDate?.tone ?? "none"}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openDueDateEditor();
          }}
          onKeyDown={(event) => {
            if (event.key === "F2") {
              event.preventDefault();
              openDueDateEditor();
            }
          }}
          aria-label={`${dueDate?.label ?? "No due date"}. Double-click or press F2 to edit the due date for ${displayTitle}.`}
        >
          {dueDate?.label ?? (displayDueAt ? "" : "No date")}
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {editError ?? (isSavingEdit ? "Saving task changes." : "")}
      </span>
      <TaskEditDialog
        item={{
          ...item,
          title: displayTitle,
          course: displayCourse,
          dueAt: displayDueAt,
        }}
        open={isEditing}
        onClose={() => setIsEditing(false)}
        onSaved={(values) => {
          setDisplayTitle(values.title);
          setDisplayCourse(values.course);
          setDisplayDueAt(values.dueAt);
        }}
      />
    </li>
  );
}
