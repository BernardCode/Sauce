import { describe, expect, it } from "vitest";
import {
  buildSchedulingGuidance,
  canScheduleOnDate,
} from "./scheduling-guidance";

describe("buildSchedulingGuidance", () => {
  it("finishes a short assignment the day before it is due", () => {
    expect(
      buildSchedulingGuidance({
        planningStartDate: "2026-08-20",
        dueDate: "2026-08-25",
        remainingMinutes: 45,
        priority: "normal",
      }),
    ).toMatchObject({
      target_completion_date: "2026-08-24",
      must_start_by: "2026-08-24",
      buffer_days: 1,
      recommended_sessions: 1,
      recommended_session_minutes: 45,
      urgency: "planned_ahead",
    });
  });

  it("starts large multi-session work only as early as its session count requires", () => {
    expect(
      buildSchedulingGuidance({
        planningStartDate: "2026-08-20",
        dueDate: "2026-08-28",
        remainingMinutes: 300,
        priority: "normal",
      }),
    ).toMatchObject({
      target_completion_date: "2026-08-27",
      must_start_by: "2026-08-24",
      buffer_days: 1,
      recommended_sessions: 4,
      recommended_session_minutes: 75,
      urgency: "planned_ahead",
    });
  });

  it("does not pull ordinary high-priority work several days forward", () => {
    expect(
      buildSchedulingGuidance({
        planningStartDate: "2026-08-20",
        dueDate: "2026-08-28",
        remainingMinutes: 120,
        priority: "high",
      }),
    ).toMatchObject({
      target_completion_date: "2026-08-27",
      must_start_by: "2026-08-26",
      buffer_days: 1,
      recommended_sessions: 2,
    });
  });

  it("uses today when the ideal completion date has already passed", () => {
    expect(
      buildSchedulingGuidance({
        planningStartDate: "2026-08-20",
        dueDate: "2026-08-21",
        remainingMinutes: 180,
        priority: "normal",
      }),
    ).toMatchObject({
      target_completion_date: "2026-08-20",
      must_start_by: "2026-08-20",
      urgency: "start_now",
    });
  });

  it("flags overdue work and preserves a missing estimate", () => {
    expect(
      buildSchedulingGuidance({
        planningStartDate: "2026-08-20",
        dueDate: "2026-08-19",
        remainingMinutes: null,
        priority: "normal",
      }),
    ).toMatchObject({
      target_completion_date: "2026-08-20",
      remaining_minutes: null,
      recommended_sessions: null,
      recommended_session_minutes: null,
      urgency: "overdue",
    });
  });
});

describe("canScheduleOnDate", () => {
  it("keeps ordinary work off a day that is two or more days before its deadline", () => {
    expect(
      canScheduleOnDate({
        scheduleDate: "2026-08-31",
        dueDate: "2026-09-03",
        remainingMinutes: 90,
      }),
    ).toBe(false);
  });

  it("allows ordinary work on the day before its deadline", () => {
    expect(
      canScheduleOnDate({
        scheduleDate: "2026-09-02",
        dueDate: "2026-09-03",
        remainingMinutes: 90,
      }),
    ).toBe(true);
  });

  it("allows a large task early only when later daily sessions cannot fit it", () => {
    expect(
      canScheduleOnDate({
        scheduleDate: "2026-08-31",
        dueDate: "2026-09-03",
        remainingMinutes: 300,
      }),
    ).toBe(true);
    expect(
      canScheduleOnDate({
        scheduleDate: "2026-08-31",
        dueDate: "2026-09-04",
        remainingMinutes: 240,
      }),
    ).toBe(false);
  });

  it("treats work without an estimate as ordinary work", () => {
    expect(
      canScheduleOnDate({
        scheduleDate: "2026-08-31",
        dueDate: "2026-09-03",
        remainingMinutes: null,
      }),
    ).toBe(false);
  });
});
