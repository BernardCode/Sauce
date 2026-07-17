import "server-only";

import { syncGoogleCalendarSource } from "./google";
import { syncIcsSource } from "./ics";

export function syncCalendarSource(source: { id: string; kind: string }) {
  if (source.kind === "gcal") return syncGoogleCalendarSource(source.id);
  if (source.kind === "ics") return syncIcsSource(source.id);
  return Promise.resolve({ ok: false as const, error: "That source cannot sync." });
}
