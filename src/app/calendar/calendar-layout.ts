export const CALENDAR_PX_PER_HOUR = 56;

export type TimedCalendarEntry<T extends { id: string }> = {
  value: T;
  startMinutes: number;
  endMinutes: number;
};

export type PlacedCalendarEntry<T extends { id: string }> =
  TimedCalendarEntry<T> & {
    top: number;
    height: number;
    lane: number;
    laneCount: number;
    zIndex: number;
  };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function placeCalendarEntries<T extends { id: string }>(
  entries: TimedCalendarEntry<T>[],
  startHour: number,
  endHour: number,
): PlacedCalendarEntry<T>[] {
  const windowStart = startHour * 60;
  const windowEnd = endHour * 60;
  const pixelsPerMinute = CALENDAR_PX_PER_HOUR / 60;
  const placed: PlacedCalendarEntry<T>[] = [];
  const ordered = [...entries]
    .filter(
      (entry) => entry.startMinutes < windowEnd && entry.endMinutes > windowStart,
    )
    .sort(
      (a, b) =>
        a.startMinutes - b.startMinutes ||
        a.endMinutes - b.endMinutes ||
        a.value.id.localeCompare(b.value.id),
    );

  const clusters: Array<typeof ordered> = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;
  for (const entry of ordered) {
    if (clusters.length === 0 || entry.startMinutes >= clusterEnd) {
      clusters.push([entry]);
      clusterEnd = entry.endMinutes;
    } else {
      clusters[clusters.length - 1].push(entry);
      clusterEnd = Math.max(clusterEnd, entry.endMinutes);
    }
  }

  for (const cluster of clusters) {
    const laneEnds: number[] = [];
    const assignments = cluster.map((entry) => {
      let lane = laneEnds.findIndex((endMinutes) => endMinutes <= entry.startMinutes);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = entry.endMinutes;
      return { entry, lane };
    });
    const laneCount = laneEnds.length;

    for (const { entry, lane } of assignments) {
      const visibleStart = clamp(entry.startMinutes, windowStart, windowEnd);
      const visibleEnd = clamp(entry.endMinutes, windowStart, windowEnd);
      placed.push({
        ...entry,
        top: (visibleStart - windowStart) * pixelsPerMinute,
        height: Math.max((visibleEnd - visibleStart) * pixelsPerMinute, 28),
        lane,
        laneCount,
        zIndex: 10 + lane,
      });
    }
  }

  return placed;
}
