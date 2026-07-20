import Link from "next/link";
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
  const commitmentCount = blocks.length + events.length + habits.length;

  return (
    <aside className="today-schedule-panel" aria-label="Today's schedule">
      <header className="today-schedule-header">
        <div className="neutral-panel-heading">
          <span className="neutral-panel-label">Schedule</span>
          <span className="neutral-panel-count">{commitmentCount}</span>
        </div>
        <Link href="/calendar?view=day">Calendar</Link>
      </header>
      {error ? (
        <p className="neutral-feedback" role="alert">{error}</p>
      ) : (
        <div className="today-schedule-scroll">
          <DayRail
            blocks={blocks}
            events={events}
            habits={habits}
            wakeHour={wakeHour}
            sleepHour={sleepHour}
            itemDueDates={itemDueDates}
          />
        </div>
      )}
    </aside>
  );
}
