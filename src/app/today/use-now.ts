"use client";

import { useSyncExternalStore } from "react";

// A shared minute-resolution clock. The server snapshot is null so the
// first client frame matches the server render, then subscribing swaps in
// the real time. This is the hydration-safe home for "what time is it".
let now: Date | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    now = new Date();
    timer = setInterval(() => {
      now = new Date();
      listeners.forEach((notify) => notify());
    }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): Date | null {
  return now;
}

function getServerSnapshot(): null {
  return null;
}

export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
