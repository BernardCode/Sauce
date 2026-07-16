import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./parse";

// Tuesday, July 14 2026, 9:00am local. Every test resolves against this
// clock so results are stable no matter when the suite runs.
const NOW = new Date(2026, 6, 14, 9, 0, 0);

// Months here are 1-based so the expected dates read like a calendar.
function local(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
): Date {
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

describe("parseQuickAdd", () => {
  it("marks a leading star as a project", () => {
    const result = parseQuickAdd("* History documentary fri 2h", NOW);
    expect(result.title).toBe("History documentary");
    expect(result.estMinutes).toBe(120);
    expect(result.isProject).toBe(true);
  });

  it("returns a plain title when nothing at the tail parses", () => {
    expect(parseQuickAdd("read chapter 4 notes", NOW)).toEqual({
      title: "read chapter 4 notes",
      dueAt: null,
      estMinutes: null,
    });
  });

  it("parses the spec example with weekday, time, and estimate", () => {
    const result = parseQuickAdd("chem lab writeup fri 5pm 90m", NOW);
    expect(result.title).toBe("chem lab writeup");
    expect(result.dueAt).toEqual(local(2026, 7, 17, 17, 0));
    expect(result.estMinutes).toBe(90);
  });

  it("accepts the estimate before the date group", () => {
    const result = parseQuickAdd("chem lab writeup 90m fri 5pm", NOW);
    expect(result.title).toBe("chem lab writeup");
    expect(result.dueAt).toEqual(local(2026, 7, 17, 17, 0));
    expect(result.estMinutes).toBe(90);
  });

  it("accepts the time before the day token", () => {
    const result = parseQuickAdd("chem lab writeup 5pm fri", NOW);
    expect(result.title).toBe("chem lab writeup");
    expect(result.dueAt).toEqual(local(2026, 7, 17, 17, 0));
    expect(result.estMinutes).toBeNull();
  });

  it("parses an estimate with no date", () => {
    expect(parseQuickAdd("review flashcards 45min", NOW)).toEqual({
      title: "review flashcards",
      dueAt: null,
      estMinutes: 45,
    });
  });

  it("parses today with a time", () => {
    const result = parseQuickAdd("essay outline today 3pm", NOW);
    expect(result.title).toBe("essay outline");
    expect(result.dueAt).toEqual(local(2026, 7, 14, 15, 0));
    expect(result.estMinutes).toBeNull();
  });

  it("parses tomorrow, defaulting to 11:59pm", () => {
    const result = parseQuickAdd("laundry tomorrow", NOW);
    expect(result.title).toBe("laundry");
    expect(result.dueAt).toEqual(local(2026, 7, 15, 23, 59));
  });

  it("parses tomorrow with an explicit time", () => {
    const result = parseQuickAdd("dentist forms tomorrow 9am", NOW);
    expect(result.title).toBe("dentist forms");
    expect(result.dueAt).toEqual(local(2026, 7, 15, 9, 0));
  });

  it("defaults a weekday with no time to 11:59pm", () => {
    const result = parseQuickAdd("problem set mon", NOW);
    expect(result.title).toBe("problem set");
    expect(result.dueAt).toEqual(local(2026, 7, 20, 23, 59));
  });

  it("parses a numeric month/day still ahead this year", () => {
    const result = parseQuickAdd("family dinner 7/20", NOW);
    expect(result.title).toBe("family dinner");
    expect(result.dueAt).toEqual(local(2026, 7, 20, 23, 59));
  });

  it("rolls a numeric month/day already past into next year", () => {
    const result = parseQuickAdd("renew passport 1/5", NOW);
    expect(result.title).toBe("renew passport");
    expect(result.dueAt).toEqual(local(2027, 1, 5, 23, 59));
  });

  it("combines a numeric date with an explicit time", () => {
    const result = parseQuickAdd("file taxes 4/15 11:59pm", NOW);
    expect(result.title).toBe("file taxes");
    expect(result.dueAt).toEqual(local(2027, 4, 15, 23, 59));
  });

  it("treats a time with no date as today", () => {
    const result = parseQuickAdd("call dentist 9:30am", NOW);
    expect(result.title).toBe("call dentist");
    expect(result.dueAt).toEqual(local(2026, 7, 14, 9, 30));
  });

  it("parses 24 hour times", () => {
    const result = parseQuickAdd("standup notes 17:00", NOW);
    expect(result.title).toBe("standup notes");
    expect(result.dueAt).toEqual(local(2026, 7, 14, 17, 0));
  });

  it("keeps a same-day weekday today when the time is still ahead", () => {
    const result = parseQuickAdd("review notes tue 8pm", NOW);
    expect(result.dueAt).toEqual(local(2026, 7, 14, 20, 0));
  });

  it("pushes a same-day weekday a week out when the time already passed", () => {
    const result = parseQuickAdd("review notes tue 8am", NOW);
    expect(result.dueAt).toEqual(local(2026, 7, 21, 8, 0));
  });

  it("keeps a same-day weekday today when the default time is still ahead", () => {
    const result = parseQuickAdd("review notes tue", NOW);
    expect(result.dueAt).toEqual(local(2026, 7, 14, 23, 59));
  });

  it("parses hour and minute estimates", () => {
    expect(parseQuickAdd("essay draft 1h30", NOW).estMinutes).toBe(90);
    expect(parseQuickAdd("essay draft 1h30m", NOW).estMinutes).toBe(90);
    expect(parseQuickAdd("essay draft 2h", NOW).estMinutes).toBe(120);
  });

  it("understands weekday spelling variants", () => {
    expect(parseQuickAdd("quiz prep thurs", NOW).dueAt).toEqual(
      local(2026, 7, 16, 23, 59),
    );
    expect(parseQuickAdd("quiz prep friday", NOW).dueAt).toEqual(
      local(2026, 7, 17, 23, 59),
    );
  });

  it("ignores case in every token", () => {
    const result = parseQuickAdd("CHEM LAB FRI 5PM 90M", NOW);
    expect(result.title).toBe("CHEM LAB");
    expect(result.dueAt).toEqual(local(2026, 7, 17, 17, 0));
    expect(result.estMinutes).toBe(90);
  });

  it("falls back to a plain untimed item on junk", () => {
    expect(parseQuickAdd("?????? !!! 13/40", NOW)).toEqual({
      title: "?????? !!! 13/40",
      dueAt: null,
      estMinutes: null,
    });
  });

  it("rejects a zero estimate and keeps the token in the title", () => {
    expect(parseQuickAdd("run 0m", NOW)).toEqual({
      title: "run 0m",
      dueAt: null,
      estMinutes: null,
    });
  });

  it("rejects a calendar-impossible month/day", () => {
    expect(parseQuickAdd("budget 2/30", NOW)).toEqual({
      title: "budget 2/30",
      dueAt: null,
      estMinutes: null,
    });
  });

  it("preserves interior spacing in the title verbatim", () => {
    const result = parseQuickAdd("fix  the  gate tomorrow", NOW);
    expect(result.title).toBe("fix  the  gate");
    expect(result.dueAt).toEqual(local(2026, 7, 15, 23, 59));
  });

  it("leaves no trailing whitespace after consuming tokens", () => {
    const result = parseQuickAdd("chem lab writeup   fri 5pm 90m", NOW);
    expect(result.title).toBe("chem lab writeup");
  });

  it("trims surrounding whitespace and handles empty input", () => {
    expect(parseQuickAdd("  buy milk  ", NOW).title).toBe("buy milk");
    expect(parseQuickAdd("", NOW)).toEqual({
      title: "",
      dueAt: null,
      estMinutes: null,
    });
    expect(parseQuickAdd("   ", NOW).title).toBe("");
  });

  it("only reads tokens from the tail, not the middle", () => {
    // "fri" is stranded once "90m" and "5pm" are consumed, because a day
    // token must sit right next to its time. It stays in the title.
    const result = parseQuickAdd("meet fri 90m 5pm", NOW);
    expect(result.title).toBe("meet fri");
    expect(result.dueAt).toEqual(local(2026, 7, 14, 17, 0));
    expect(result.estMinutes).toBe(90);
  });
});
