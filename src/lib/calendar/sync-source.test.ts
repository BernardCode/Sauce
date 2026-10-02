import { beforeEach, describe, expect, it, vi } from "vitest";

const syncGoogle = vi.hoisted(() => vi.fn(async () => ({ ok: true as const, count: 2 })));
vi.mock("server-only", () => ({}));
vi.mock("./google", () => ({ syncGoogleCalendarSource: syncGoogle }));

import { syncCalendarSource } from "./sync-source";

beforeEach(() => vi.clearAllMocks());

describe("calendar source sync", () => {
  it("rejects existing Schoology and other ICS sources without syncing", async () => {
    const result = await syncCalendarSource({ id: "existing-schoology-feed", kind: "ics" });
    expect(result).toEqual({
      ok: false,
      error: "Assignment imports are disabled. Add tasks manually.",
    });
    expect(syncGoogle).not.toHaveBeenCalled();
  });

  it("continues syncing Google calendar events", async () => {
    await expect(syncCalendarSource({ id: "google-calendar", kind: "gcal" })).resolves.toEqual({ ok: true, count: 2 });
    expect(syncGoogle).toHaveBeenCalledWith("google-calendar");
  });
});
