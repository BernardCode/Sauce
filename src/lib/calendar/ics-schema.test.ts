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
      .map((component) => toIcsItemCandidate(component))
      .find((candidate) => candidate !== null);
    expect(item).toMatchObject({
      externalId: "canvas-assignment-42",
      dueAt: "2026-07-20T23:59:00.000Z",
    });
  });

  it("reads a Schoology class from an explicit calendar property", () => {
    expect(
      toIcsItemCandidate(
        {
          type: "VEVENT",
          uid: "schoology-assignment-1",
          summary: "Problem set",
          start: new Date("2026-07-20T23:59:00.000Z"),
          "SCHOOLOGY-COURSE": { val: "AP Calc BC" },
          categories: ["Assignment", "Fallback course"],
          location: "Another fallback",
        },
        { inferSchoologyCourse: true },
      ),
    ).toMatchObject({ course: "AP Calc BC" });
  });

  it("reads a Schoology class from a labeled description", () => {
    expect(
      toIcsItemCandidate(
        {
          type: "VEVENT",
          uid: "schoology-assignment-2",
          summary: "Reading response",
          description: "Bring your notes.\nCourse: AP Lit",
          start: new Date("2026-07-20T23:59:00.000Z"),
        },
        { inferSchoologyCourse: true },
      ),
    ).toMatchObject({ course: "AP Lit" });
  });

  it("reads a Schoology class from categories before location", () => {
    const parsed = ical.sync.parseICS(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:schoology-assignment-3
DTSTAMP:20260716T120000Z
DTSTART:20260720T235900Z
SUMMARY:Lab analysis
CATEGORIES:Assignment,AP Physics C
LOCATION:Room 101
END:VEVENT
END:VCALENDAR`);
    const item = Object.values(parsed)
      .map((component) =>
        toIcsItemCandidate(component, { inferSchoologyCourse: true }),
      )
      .find((candidate) => candidate !== null);
    expect(item).toMatchObject({
      course: "AP Physics C",
      dueDate: null,
    });
  });

  it("preserves the calendar date for date-only Schoology deadlines", () => {
    const parsed = ical.sync.parseICS(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:schoology-date-only
DTSTAMP:20260901T120000Z
DTSTART;VALUE=DATE:20260904
SUMMARY:Video notes
LOCATION:AP Physics C
END:VEVENT
END:VCALENDAR`);
    const item = toIcsItemCandidate(parsed["schoology-date-only"], {
      inferSchoologyCourse: true,
    });
    expect(item).toMatchObject({
      course: "AP Physics C",
      dueDate: "2026-09-04",
    });
  });

  it("does not infer courses for a generic ICS feed", () => {
    expect(
      toIcsItemCandidate({
        type: "VEVENT",
        uid: "generic-event",
        summary: "Study group",
        categories: ["Personal"],
        location: "Library",
        start: new Date("2026-07-20T23:59:00.000Z"),
      }),
    ).toMatchObject({ course: null });
  });

  it("does not treat the ICS privacy class as a school class", () => {
    expect(
      toIcsItemCandidate(
        {
          type: "VEVENT",
          uid: "schoology-assignment-4",
          summary: "Essay outline",
          class: "PUBLIC",
          start: new Date("2026-07-20T23:59:00.000Z"),
        },
        { inferSchoologyCourse: true },
      ),
    ).toMatchObject({ course: null });
  });
});
