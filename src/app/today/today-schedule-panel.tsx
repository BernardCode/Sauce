import { DayRail } from "./day-rail";
import type {
  TodayBlock,
  TodayEvent,
  TodayScheduledHabit,
} from "./types";

type Props = {
  blocks: TodayBlock[];
  events: TodayEvent[];
  habits: TodayScheduledHabit[];
  wakeHour: number;
  sleepHour: number;
  itemDueDates: Record<string, string | null>;
  error: string | null;
};

export function TodaySchedulePanel({
  blocks,
  events,
  habits,
  wakeHour,
  sleepHour,
  itemDueDates,
  error,
}: Props) {
  return (
    <aside className="today-schedule-panel" aria-labelledby="today-schedule-heading">
      <header className="today-schedule-header">
        <h2 id="today-schedule-heading">Schedule</h2>
      </header>
      {error ? (
        <p className="neutral-feedback" role="alert">{error}</p>
      ) : (
        <DayRail
          blocks={blocks}
          events={events}
          habits={habits}
          wakeHour={wakeHour}
          sleepHour={sleepHour}
          itemDueDates={itemDueDates}
        />
      )}
    </aside>
  );
}
