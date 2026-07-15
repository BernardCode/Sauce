"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { recordBlockWork } from "./block-actions";

// The start time lives in localStorage so an accidental refresh does not
// lose a running session.
function storageKey(blockId: string): string {
  return `do-now-${blockId}`;
}

function readStoredStart(blockId: string): number | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(storageKey(blockId));
  if (stored === null) return null;
  const parsedMs = Number(stored);
  return Number.isFinite(parsedMs) ? parsedMs : null;
}

// A shared once-a-second clock, same shape as use-now.ts but at second
// resolution because a work counter that only moves once a minute reads
// as frozen.
let tickNow: number | null = null;
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;

function subscribeTick(listener: () => void): () => void {
  tickListeners.add(listener);
  if (tickTimer === null) {
    tickNow = Date.now();
    tickTimer = setInterval(() => {
      tickNow = Date.now();
      tickListeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

function getTick(): number | null {
  return tickNow;
}

function getServerTick(): null {
  return null;
}

type Props = {
  blockId: string;
};

export function DoNowCounter({ blockId }: Props) {
  // Lazy read is safe: the popover only mounts on click, well after
  // hydration, so server and client never disagree here.
  const [startedAt, setStartedAt] = useState<number | null>(() =>
    readStoredStart(blockId),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const tick = useSyncExternalStore(subscribeTick, getTick, getServerTick);

  function start() {
    const now = Date.now();
    window.localStorage.setItem(storageKey(blockId), String(now));
    setStartedAt(now);
    setError(null);
  }

  function discard() {
    window.localStorage.removeItem(storageKey(blockId));
    setStartedAt(null);
  }

  function stop() {
    if (startedAt === null || isPending) return;
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    startTransition(async () => {
      const result = await recordBlockWork({ id: blockId, minutes });
      if (result.error) {
        setError(result.error);
      } else {
        window.localStorage.removeItem(storageKey(blockId));
        setStartedAt(null);
        setError(null);
      }
    });
  }

  if (startedAt === null) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={start}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Do this now
        </button>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    );
  }

  const totalSeconds = Math.floor(
    Math.max(0, (tick ?? startedAt) - startedAt) / 1000,
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm tabular-nums">
          {minutes}:{String(seconds).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={stop}
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={discard}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Discard
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
