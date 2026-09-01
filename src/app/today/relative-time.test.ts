import { describe, expect, it } from "vitest";
import { formatDue, formatDueDate } from "./relative-time";

const NOW = new Date(2026, 6, 14, 9, 0, 0);

describe("formatDue", () => {
  it("marks a past due date as overdue", () => {
    const result = formatDue(new Date(2026, 6, 14, 8, 30, 0), NOW);

    expect(result.tone).toBe("overdue");
    expect(result.label).toBe("overdue by 30m");
  });

  it("marks a due date inside 24 hours as soon", () => {
    const result = formatDue(new Date(2026, 6, 15, 8, 59, 0), NOW);

    expect(result.tone).toBe("soon");
  });

  it("does not mark a due date exactly 24 hours away as soon", () => {
    const result = formatDue(new Date(2026, 6, 15, 9, 0, 0), NOW);

    expect(result.tone).toBe("normal");
  });

  it("uses relative language for tomorrow", () => {
    const result = formatDue(new Date(2026, 6, 15, 17, 0, 0), NOW);

    expect(result.label).toBe("due tomorrow 5pm");
  });

  it("formats compact due-column labels", () => {
    expect(formatDueDate(new Date(2026, 6, 14, 17, 0, 0), NOW)).toEqual({
      label: "Today",
      tone: "soon",
    });
    expect(formatDueDate(new Date(2026, 6, 15, 17, 0, 0), NOW).label).toBe(
      "Tomorrow",
    );
    expect(formatDueDate(new Date(2026, 7, 3, 17, 0, 0), NOW).label).toBe(
      "Aug 3",
    );
  });
});
