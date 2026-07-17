import { describe, expect, it } from "vitest";
import ical from "node-ical";
import { toIcsItemCandidate } from "./ics-schema";

describe("ICS item boundary", () => {
  it("accepts a dated assignment", () => {
    expect(
      toIcsItemCandidate({
        type: "VEVENT",
        uid: "assignment-1",
        summary: "Essay draft",
        start: new Date("2026-07-20T23:59:00.000Z"),
        priority: 2,
      }),
    ).toMatchObject({
      externalId: "assignment-1",
      title: "Essay draft",
      priority: "high",
    });
  });

  it("rejects completed, cancelled, and undated components", () => {
    expect(toIcsItemCandidate({ type: "VTODO", uid: "1", status: "COMPLETED", due: new Date() })).toBeNull();
    expect(toIcsItemCandidate({ type: "VEVENT", uid: "2", status: "CANCELLED", start: new Date() })).toBeNull();
    expect(toIcsItemCandidate({ type: "VEVENT", uid: "3" })).toBeNull();
  });

  it("validates output produced by node-ical", () => {
    const parsed = ical.sync.parseICS(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:canvas-assignment-42
DTSTAMP:20260716T120000Z
DTSTART:20260720T235900Z
SUMMARY:Submit research notes
END:VEVENT
END:VCALENDAR`);
    const item = Object.values(parsed)
      .map(toIcsItemCandidate)
      .find((candidate) => candidate !== null);
    expect(item).toMatchObject({
      externalId: "canvas-assignment-42",
      dueAt: "2026-07-20T23:59:00.000Z",
    });
  });
});
