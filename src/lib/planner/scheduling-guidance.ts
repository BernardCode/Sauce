const DAY_MS = 86_400_000;
const MAX_SESSION_MINUTES = 90;
const LARGE_TASK_MINUTES = 180;

export type SchedulingUrgency =
  | "overdue"
  | "due_today"
  | "start_now"
  | "planned_ahead";

type SchedulingGuidanceInput = {
  planningStartDate: string;
  dueDate: string;
  remainingMinutes: number | null;
  priority: string;
};

export type SchedulingGuidance = {
  target_completion_date: string;
  must_start_by: string;
  buffer_days: number;
  remaining_minutes: number | null;
  recommended_sessions: number | null;
  recommended_session_minutes: number | null;
  urgency: SchedulingUrgency;
};

function dateValue(date: string): number {
  return new Date(`${date}T12:00:00Z`).getTime();
}

function shiftDate(date: string, days: number): string {
  return new Date(dateValue(date) + days * DAY_MS).toISOString().slice(0, 10);
}

type ScheduleDateInput = {
  scheduleDate: string;
  dueDate: string;
  remainingMinutes: number | null;
};

export function canScheduleOnDate({
  scheduleDate,
  dueDate,
  remainingMinutes,
}: ScheduleDateInput): boolean {
  const daysUntilDue = Math.round(
    (dateValue(dueDate) - dateValue(scheduleDate)) / DAY_MS,
  );
  if (daysUntilDue < 2) return true;
  if (remainingMinutes === null || remainingMinutes <= LARGE_TASK_MINUTES) {
    return false;
  }

  const laterSessionCapacity = (daysUntilDue - 1) * MAX_SESSION_MINUTES;
  return remainingMinutes > laterSessionCapacity;
}

export function buildSchedulingGuidance({
  planningStartDate,
  dueDate,
  remainingMinutes,
}: SchedulingGuidanceInput): SchedulingGuidance {
  const dueValue = dateValue(dueDate);
  const planningStartValue = dateValue(planningStartDate);
  const bufferDays = 1;
  const unboundedTarget = shiftDate(dueDate, -bufferDays);
  const targetCompletionDate =
    dateValue(unboundedTarget) < planningStartValue
      ? planningStartDate
      : unboundedTarget;
  const recommendedSessions =
    remainingMinutes === null
      ? null
      : Math.max(1, Math.ceil(remainingMinutes / MAX_SESSION_MINUTES));
  const recommendedSessionMinutes =
    remainingMinutes === null || recommendedSessions === null
      ? null
      : Math.ceil(remainingMinutes / recommendedSessions);
  const unboundedStart = shiftDate(
    targetCompletionDate,
    -Math.max(0, (recommendedSessions ?? 1) - 1),
  );
  const mustStartBy =
    dateValue(unboundedStart) < planningStartValue
      ? planningStartDate
      : unboundedStart;

  let urgency: SchedulingUrgency = "planned_ahead";
  if (dueValue < planningStartValue) urgency = "overdue";
  else if (dueValue === planningStartValue) urgency = "due_today";
  else if (dateValue(mustStartBy) <= planningStartValue) urgency = "start_now";

  return {
    target_completion_date: targetCompletionDate,
    must_start_by: mustStartBy,
    buffer_days: bufferDays,
    remaining_minutes: remainingMinutes,
    recommended_sessions: recommendedSessions,
    recommended_session_minutes: recommendedSessionMinutes,
    urgency,
  };
}
