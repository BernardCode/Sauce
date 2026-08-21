import { describe, expect, it } from "vitest";
import { buildSchedulingGuidance } from "./scheduling-guidance";

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

  it("starts multi-session work early and finishes several days ahead", () => {
    expect(
      buildSchedulingGuidance({
        planningStartDate: "2026-08-20",
        dueDate: "2026-08-28",
        remainingMinutes: 300,
        priority: "normal",
      }),
    ).toMatchObject({
      target_completion_date: "2026-08-25",
      must_start_by: "2026-08-22",
      buffer_days: 3,
      recommended_sessions: 4,
      recommended_session_minutes: 75,
      urgency: "planned_ahead",
    });
  });

  it("adds another buffer day for high-priority work", () => {
    expect(
      buildSchedulingGuidance({
        planningStartDate: "2026-08-20",
        dueDate: "2026-08-28",
        remainingMinutes: 120,
        priority: "high",
      }),
    ).toMatchObject({
      target_completion_date: "2026-08-25",
      must_start_by: "2026-08-24",
      buffer_days: 3,
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
