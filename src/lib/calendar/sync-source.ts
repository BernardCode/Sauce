import "server-only";

import { syncGoogleCalendarSource } from "./google";

export function syncCalendarSource(source: { id: string; kind: string }) {
  if (source.kind === "gcal") return syncGoogleCalendarSource(source.id);
  if (source.kind === "ics") {
    return Promise.resolve({
      ok: false as const,
      error: "Assignment imports are disabled. Add tasks manually.",
    });
  }
  return Promise.resolve({ ok: false as const, error: "That source cannot sync." });
}
