"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ExternalLink, Keyboard, Plus, X } from "lucide-react";
import { OPEN_COMMAND_MENU_EVENT, type OpenCommandMenuDetail } from "./ui-events";

const routeShortcuts: Record<string, string> = {
  a: "/assignments",
  c: "/calendar",
  h: "/habits",
  s: "/sat",
  t: "/today",
};

const prefetchedRoutes = ["/today", "/assignments", "/calendar", "/focus", "/sat", "/habits"];

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']");
}

function openTaskCapture() {
  window.dispatchEvent(
    new CustomEvent<OpenCommandMenuDetail>(OPEN_COMMAND_MENU_EVENT, {
      detail: { mode: "add" },
    }),
  );
}

export function AppQuickActions() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const goSequenceRef = useRef(false);
  const goTimerRef = useRef<number | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [waitingForDestination, setWaitingForDestination] = useState(false);

  useEffect(() => {
    for (const route of prefetchedRoutes) router.prefetch(route);
  }, [router]);

  useEffect(() => {
    function clearGoSequence() {
      goSequenceRef.current = false;
      setWaitingForDestination(false);
      if (goTimerRef.current !== null) window.clearTimeout(goTimerRef.current);
      goTimerRef.current = null;
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setShortcutsOpen(false);
        clearGoSequence();
        return;
      }
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen((current) => !current);
        return;
      }
      if (key === "n") {
        event.preventDefault();
        openTaskCapture();
        return;
      }
      if (goSequenceRef.current) {
        const destination = routeShortcuts[key];
        clearGoSequence();
        if (destination) {
          event.preventDefault();
          router.push(destination);
        }
        return;
      }
      if (key === "g") {
        event.preventDefault();
        goSequenceRef.current = true;
        setWaitingForDestination(true);
        goTimerRef.current = window.setTimeout(clearGoSequence, 1200);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (goTimerRef.current !== null) window.clearTimeout(goTimerRef.current);
    };
  }, [router]);

  useEffect(() => {
    if (!shortcutsOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setShortcutsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [shortcutsOpen]);

  return (
    <div ref={rootRef} className="app-quick-actions">
      <button type="button" onClick={openTaskCapture} className="app-tool-button app-add-task" title="Add task (N)">
        <Plus size={15} />
        <span>Add task</span>
      </button>
      <a
        href="https://calendar.google.com/calendar/u/0/r"
        target="_blank"
        rel="noreferrer"
        className="app-tool-button"
        aria-label="Open Google Calendar"
        title="Open Google Calendar"
      >
        <CalendarDays size={15} />
        <span className="app-tool-label">Google Calendar</span>
        <ExternalLink className="app-tool-external" size={11} />
      </a>
      <button
        type="button"
        onClick={() => setShortcutsOpen((current) => !current)}
        className="app-tool-button app-tool-icon"
        aria-label="Show keyboard shortcuts"
        aria-expanded={shortcutsOpen}
        title="Keyboard shortcuts (?)"
      >
        <Keyboard size={16} />
      </button>

      {waitingForDestination ? <div className="shortcut-chord">G then T, A, C, S, or H</div> : null}
      {shortcutsOpen ? (
        <div className="shortcut-popover" role="dialog" aria-label="Keyboard shortcuts">
          <div className="shortcut-popover-heading">
            <div><strong>Keyboard shortcuts</strong><span>Move without reaching for the mouse.</span></div>
            <button type="button" onClick={() => setShortcutsOpen(false)} aria-label="Close keyboard shortcuts"><X size={15} /></button>
          </div>
          <div className="shortcut-list">
            <div><span>Add a task</span><kbd>N</kbd></div>
            <div><span>Find or jump</span><kbd>⌘ K</kbd></div>
            <div><span>Today</span><kbd>G T</kbd></div>
            <div><span>Assignments</span><kbd>G A</kbd></div>
            <div><span>Calendar</span><kbd>G C</kbd></div>
            <div><span>SAT Studio</span><kbd>G S</kbd></div>
            <div><span>Habits</span><kbd>G H</kbd></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
