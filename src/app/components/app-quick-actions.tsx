"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OPEN_COMMAND_MENU_EVENT, type OpenCommandMenuDetail } from "./ui-events";

const routeShortcuts: Record<string, string> = {
  c: "/calendar",
  h: "/habits",
  s: "/sat",
  t: "/today",
};

const prefetchedRoutes = [
  "/today",
  "/calendar",
  "/focus",
  "/sat",
  "/habits",
  "/more",
  "/projects",
  "/notes",
  "/links",
  "/review",
  "/settings",
];

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
    function prefetchWorkspace() {
      for (const route of prefetchedRoutes) router.prefetch(route);
    }

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchWorkspace, {
        timeout: 1_500,
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(prefetchWorkspace, 250);
    return () => globalThis.clearTimeout(timeoutId);
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
        Add task
      </button>
      <a
        href="https://calendar.google.com/calendar/u/0/r"
        target="_blank"
        rel="noreferrer"
        className="app-tool-button"
        aria-label="Open Google Calendar"
        title="Open Google Calendar"
      >
        <span className="app-tool-label">Google Calendar</span>
      </a>
      <button
        type="button"
        onClick={() => setShortcutsOpen((current) => !current)}
        className="app-tool-button"
        aria-label="Show keyboard shortcuts"
        aria-expanded={shortcutsOpen}
        title="Keyboard shortcuts (?)"
      >
        Shortcuts
      </button>

      {waitingForDestination ? <div className="shortcut-chord">G then T, C, S, or H</div> : null}
      {shortcutsOpen ? (
        <div className="shortcut-popover" role="dialog" aria-label="Keyboard shortcuts">
          <div className="shortcut-popover-heading">
            <strong>Keyboard shortcuts</strong>
            <button type="button" onClick={() => setShortcutsOpen(false)} aria-label="Close keyboard shortcuts">Close</button>
          </div>
          <div className="shortcut-list">
            <div><span>Add a task</span><kbd>N</kbd></div>
            <div><span>Find or jump</span><kbd>⌘ K</kbd></div>
            <div><span>Today</span><kbd>G T</kbd></div>
            <div><span>Calendar</span><kbd>G C</kbd></div>
            <div><span>SAT Studio</span><kbd>G S</kbd></div>
            <div><span>Habits</span><kbd>G H</kbd></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
