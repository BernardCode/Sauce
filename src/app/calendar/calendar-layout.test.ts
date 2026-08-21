import { describe, expect, it } from "vitest";
import {
  CALENDAR_PX_PER_HOUR,
  placeCalendarEntries,
} from "./calendar-layout";

describe("placeCalendarEntries", () => {
  it("sorts cards by their start time", () => {
    const placed = placeCalendarEntries(
      [
        { value: { id: "late" }, startMinutes: 600, endMinutes: 660 },
        { value: { id: "early" }, startMinutes: 480, endMinutes: 510 },
        { value: { id: "middle" }, startMinutes: 540, endMinutes: 600 },
      ],
      7,
      23,
    );

    expect(placed.map((entry) => entry.value.id)).toEqual([
      "early",
      "middle",
      "late",
    ]);
  });

  it("scales card height with duration", () => {
    const placed = placeCalendarEntries(
      [
        { value: { id: "half-hour" }, startMinutes: 480, endMinutes: 510 },
        { value: { id: "one-hour" }, startMinutes: 540, endMinutes: 600 },
        { value: { id: "two-hours" }, startMinutes: 660, endMinutes: 780 },
      ],
      7,
      23,
    );

    expect(placed.map((entry) => entry.height)).toEqual([
      CALENDAR_PX_PER_HOUR / 2,
      CALENDAR_PX_PER_HOUR,
      CALENDAR_PX_PER_HOUR * 2,
    ]);
  });

  it("places overlapping cards in separate horizontal lanes", () => {
    const placed = placeCalendarEntries(
      [
        { value: { id: "first" }, startMinutes: 540, endMinutes: 660 },
        { value: { id: "overlap" }, startMinutes: 570, endMinutes: 630 },
      ],
      7,
      23,
    );

    expect(placed[0]).toMatchObject({ lane: 0, laneCount: 2 });
    expect(placed[1]).toMatchObject({ lane: 1, laneCount: 2 });
  });
});
