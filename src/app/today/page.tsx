import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppHeader } from "@/app/components/app-header";
import { syncCalendarSource } from "@/lib/calendar/sync-source";
import { habitIsDue } from "@/lib/habits/due";
import {
  habitDaysSchema,
  workingHoursSchema,
} from "@/lib/planner/schemas";
import { localParts, safeTimeZone } from "@/lib/planner/time";
import { createClient } from "@/lib/supabase/server";
import { MagicDust, type MagicDustMood } from "@/components/ui/magic-dust";
import { ItemList } from "./item-list";
import type { TodayItem } from "./task-types";
import { TodaySchedulePanel } from "./today-schedule-panel";
import type {
  TodayBlock,
  TodayEvent,
  TodayScheduledHabit,
} from "./types";

type ItemRow = {
  id: string;
  title: string;
  course: string | null;
  due_at: string | null;
  est_minutes: number | null;
  remaining_minutes: number | null;
  is_project: boolean;
  origin: string;
  priority: string;
};

type BlockRow = {
  id: string;
  item_id: string | null;
  title: string;
  start_at: string;
  end_at: string;
  origin: string;
  locked: boolean;
  done: boolean;
  reason: string | null;
  actual_minutes: number | null;
};

type EventRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
};

const itemColumns =
  "id, title, course, due_at, est_minutes, remaining_minutes, is_project, origin, priority";
const blockColumns =
  "id, item_id, title, start_at, end_at, origin, locked, done, reason, actual_minutes";
const eventColumns = "id, title, start_at, end_at, all_day";

function staleSourceCutoffMs(): number {
  return Date.now() - 15 * 60 * 1000;
}

function scheduleWindow(): { start: string; end: string } {
  return {
    start: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    end: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };
}

function overlapsLocalDate(
  startAt: string,
  endAt: string,
  date: string,
  timeZone: string,
): boolean {
  const startDate = localParts(new Date(startAt), timeZone).date;
  const endDate = localParts(
    new Date(Math.max(Date.parse(startAt), Date.parse(endAt) - 1)),
    timeZone,
  ).date;
  return startDate <= date && endDate >= date;
}

function toTodayItem(row: ItemRow): TodayItem {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    dueAt: row.due_at,
    estMinutes: row.est_minutes,
    isProject: row.is_project,
    origin: row.origin,
  };
}

function toTodayBlock(row: BlockRow): TodayBlock {
  return {
    id: row.id,
    itemId: row.item_id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    origin: row.origin,
    locked: row.locked,
    done: row.done,
    reason: row.reason,
    actualMinutes: row.actual_minutes,
  };
}

function toTodayEvent(row: EventRow): TodayEvent {
  return {
    id: row.id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
  };
}

function workloadMood(
  items: ItemRow[],
  today: string,
  timeZone: string,
): MagicDustMood {
  const remainingMinutes = items.reduce(
    (total, item) => total + (item.remaining_minutes ?? item.est_minutes ?? 0),
    0,
  );
  const hasUrgentItem = items.some(
    (item) =>
      item.priority === "high" ||
      (item.due_at !== null &&
        localParts(new Date(item.due_at), timeZone).date <= today),
  );

  return hasUrgentItem || remainingMinutes >= 240 ? "urgent" : "calm";
}

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const window = scheduleWindow();
  const [
    sourcesResult,
    openResult,
    blocksResult,
    eventsResult,
    profileResult,
    habitsResult,
  ] = await Promise.all([
    supabase
      .from("sources")
      .select("id, kind, enabled, last_synced_at")
      .eq("user_id", user.id),
    supabase
      .from("items")
      .select(itemColumns)
      .eq("user_id", user.id)
      .eq("status", "open")
      .is("parent_id", null)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("blocks")
      .select(blockColumns)
      .eq("user_id", user.id)
      .lt("start_at", window.end)
      .gt("end_at", window.start)
      .order("start_at", { ascending: true }),
    supabase
      .from("events")
      .select(eventColumns)
      .eq("user_id", user.id)
      .lt("start_at", window.end)
      .gt("end_at", window.start)
      .order("start_at", { ascending: true }),
    supabase
      .from("users")
      .select("timezone, working_hours_json")
      .eq("id", user.id)
      .single(),
    supabase
      .from("habits")
      .select("id, name, cadence, days_json, scheduled_time")
      .eq("user_id", user.id)
      .eq("archived", false)
      .not("scheduled_time", "is", null)
      .order("scheduled_time"),
  ]);

  const sources = sourcesResult.data;
  const staleCutoff = staleSourceCutoffMs();
  const staleSources = (sources ?? []).filter(
    (source) =>
      source.enabled &&
      ["gcal", "ics"].includes(source.kind) &&
      (!source.last_synced_at ||
        new Date(source.last_synced_at).getTime() < staleCutoff),
  );

  if (staleSources.length) {
    after(async () => {
      await Promise.allSettled(
        staleSources.map((source) => syncCalendarSource(source)),
      );
    });
  }

  const openItems = ((openResult.data ?? []) as ItemRow[]).map(toTodayItem);
  const timeZone = safeTimeZone(profileResult.data?.timezone ?? "UTC");
  const localToday = localParts(new Date(), timeZone);
  const dustMood = workloadMood(
    (openResult.data ?? []) as ItemRow[],
    localToday.date,
    timeZone,
  );
  const parsedHours = workingHoursSchema.safeParse(
    profileResult.data?.working_hours_json ?? {},
  );
  const plannerHours = parsedHours.success
    ? parsedHours.data
    : workingHoursSchema.parse({});

  const blocks = ((blocksResult.data ?? []) as BlockRow[])
    .map(toTodayBlock)
    .filter((block) =>
      overlapsLocalDate(block.startAt, block.endAt, localToday.date, timeZone),
    );
  const events = ((eventsResult.data ?? []) as EventRow[])
    .map(toTodayEvent)
    .filter((event) =>
      overlapsLocalDate(event.startAt, event.endAt, localToday.date, timeZone),
    );
  const dueHabits = (habitsResult.data ?? []).filter((habit) => {
    const parsedDays = habitDaysSchema.safeParse(habit.days_json ?? []);
    return habitIsDue(
      habit.cadence,
      parsedDays.success ? parsedDays.data : [],
      localToday.weekday,
    );
  });
  const habitLogsResult = dueHabits.length
    ? await supabase
        .from("habit_logs")
        .select("habit_id, done")
        .eq("user_id", user.id)
        .eq("date", localToday.date)
        .in("habit_id", dueHabits.map((habit) => habit.id))
    : { data: [], error: null };
  const doneHabitIds = new Set(
    (habitLogsResult.data ?? [])
      .filter((log) => log.done)
      .map((log) => log.habit_id),
  );
  const scheduledHabits: TodayScheduledHabit[] = dueHabits.map((habit) => ({
    id: `${habit.id}:${localToday.date}`,
    habitId: habit.id,
    name: habit.name,
    date: localToday.date,
    scheduledTime: habit.scheduled_time?.slice(0, 5) ?? "00:00",
    done: doneHabitIds.has(habit.id),
  }));
  const itemDueDates = Object.fromEntries(
    openItems.map((item) => [item.id, item.dueAt]),
  );
  const scheduleKey = [
    localToday.date,
    ...blocks.map(
      (block) =>
        `${block.id}:${block.startAt}:${block.endAt}:${block.locked}`,
    ),
    ...events.map((event) => event.id),
    ...scheduledHabits.map((habit) => `${habit.id}:${habit.done}`),
  ].join("|");
  const taskLoadError = openResult.error;
  const scheduleLoadError =
    blocksResult.error ??
    eventsResult.error ??
    profileResult.error ??
    habitsResult.error ??
    habitLogsResult.error;

  return (
    <div className="app-page" data-page="today">
      <AppHeader />
      <MagicDust mood={dustMood} />
      <main className="flex flex-1 flex-col">
        <div className="today-daily-page">
          <header className="today-simple-header">
            <h1 className="page-title">Today</h1>
          </header>
          <div className="today-daily-grid">
            <section className="today-task-column" aria-label="Tasks">
              {taskLoadError ? (
                <p className="today-empty-state">
                  Could not load your tasks. Refresh to try again.
                </p>
              ) : (
                <ItemList openItems={openItems} />
              )}
            </section>
            <TodaySchedulePanel
              key={scheduleKey}
              blocks={blocks}
              events={events}
              habits={scheduledHabits}
              wakeHour={plannerHours.wake}
              sleepHour={plannerHours.sleep}
              itemDueDates={itemDueDates}
              error={scheduleLoadError ? "Could not load today's schedule." : null}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
