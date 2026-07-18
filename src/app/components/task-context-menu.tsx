"use client";

import Link from "next/link";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type TaskContextMenuHandle = {
  openAt: (x: number, y: number) => void;
};

type Props = {
  title: string;
  details?: string;
  dueAt: string | null;
  scheduled: boolean;
  projectHref?: string;
  onComplete?: () => void;
  onShowSchedule?: () => void;
};

type MenuPosition = { left: number; top: number };

function localDateStamp(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function googleCalendarUrl(title: string, dueAt: string | null): string | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const start = new Date(due);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Due: ${title}`,
    dates: `${localDateStamp(start)}/${localDateStamp(end)}`,
    details: `Deadline from sauce. Due ${due.toLocaleString()}.`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const TaskContextMenu = forwardRef<TaskContextMenuHandle, Props>(function TaskContextMenu(
  { title, details, dueAt, scheduled, projectHref, onComplete, onShowSchedule },
  ref,
) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [copied, setCopied] = useState(false);
  const calendarUrl = useMemo(() => googleCalendarUrl(title, dueAt), [dueAt, title]);

  function close() {
    setPosition(null);
    setCopied(false);
  }

  function openAt(x: number, y: number) {
    const menuWidth = 252;
    const menuHeight = 280;
    setCopied(false);
    setPosition({
      left: Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12)),
      top: Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12)),
    });
  }

  useImperativeHandle(ref, () => ({ openAt }), []);

  useEffect(() => {
    if (!position) return;
    menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus({ preventScroll: true });

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
    };
  }, [position]);

  async function copyTask() {
    const copy = [title, details].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(copy);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="task-menu-trigger"
        draggable={false}
        aria-label={`More actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={position !== null}
        onDragStart={(event) => event.preventDefault()}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          openAt(rect.right - 252, rect.bottom + 6);
        }}
      >
        Actions
      </button>
      {position ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${title}`}
          className="task-context-menu"
          style={position}
        >
          <div className="task-context-title"><span>Task actions</span><strong>{title}</strong></div>
          {projectHref ? <Link href={projectHref} role="menuitem" onClick={close}>Open project</Link> : null}
          {onShowSchedule ? <button type="button" role="menuitem" onClick={() => { onShowSchedule(); close(); }}>Show on today&apos;s schedule</button> : null}
          <Link href="/calendar" role="menuitem" onClick={close}>{scheduled ? "View in sauce calendar" : "Plan in sauce calendar"}</Link>
          {calendarUrl ? <a href={calendarUrl} target="_blank" rel="noreferrer" role="menuitem" onClick={close}>Add deadline to Google Calendar</a> : null}
          <button type="button" role="menuitem" onClick={copyTask}>{copied ? "Copied" : "Copy task details"}</button>
          {onComplete ? <button type="button" role="menuitem" className="task-context-complete" onClick={() => { onComplete(); close(); }}>Mark complete</button> : null}
        </div>,
        document.body,
      ) : null}
    </>
  );
});
