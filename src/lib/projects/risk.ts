export type ProjectRiskInput = {
  nowMs: number;
  deadlineMs: number | null;
  remainingMinutes: number;
  availableMinutes: number;
  scheduledEndTimesMs: number[];
};

export function isProjectAtRisk(input: ProjectRiskInput): boolean {
  if (input.deadlineMs === null || input.remainingMinutes <= 0) return false;
  const deadlineMs = input.deadlineMs;
  if (deadlineMs <= input.nowMs) return true;
  if (input.scheduledEndTimesMs.some((end) => end > deadlineMs)) {
    return true;
  }
  return input.remainingMinutes > Math.max(0, input.availableMinutes);
}
