import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { AppHeader } from "@/app/components/app-header";
import { syncCalendarSource } from "@/lib/calendar/sync-source";
import { buildHabitSchedule } from "@/lib/habits/schedule";
import { habitDaysSchema } from "@/lib/planner/schemas";
import { createClient } from "@/lib/supabase/server";
import { CalendarBoard } from "./calendar-board";

const querySchema = z.object({
  view: z.enum(["month", "week", "day"]).default("week"),
  date: z.iso.date().optional(),
});

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function rangeLabel(view: "month" | "week" | "day", anchor: Date): string {
  if (view === "month") {
    return anchor.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }
  if (view === "day") {
    return anchor.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const start = addDays(anchor, -anchor.getDay());
  const end = addDays(start, 6);
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} to ${endLabel}`;
}

function getRange(view: "month" | "week" | "day", anchor: Date) {
  if (view === "day") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    return { start, end: addDays(start, 1), days: [dateKey(start)], step: 1 };
  }
  if (view === "week") {
    const start = addDays(anchor, -anchor.getDay());
    return {
      start,
      end: addDays(start, 7),
      days: Array.from({ length: 7 }, (_, index) => dateKey(addDays(start, index))),
      step: 7,
    };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return {
    start,
    end: addDays(start, 42),
    days: Array.from({ length: 42 }, (_, index) => dateKey(addDays(start, index))),
    step: 28,
  };
}

// This page is request-rendered. Keeping the wall-clock read outside the
// component body avoids treating it like stable render state.
function staleCutoffMs(): number {
  return Date.now() - 15 * 60 * 1000;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const parsedQuery = querySchema.safeParse(await searchParams);
  const query = parsedQuery.success ? parsedQuery.data : querySchema.parse({});
  const anchor = query.date
    ? new Date(`${query.date}T12:00:00`)
    : new Date();
  const range = getRange(query.view, anchor);

  const [
    blocksResult,
    eventsResult,
    itemsResult,
    liveBlocksResult,
    sourcesResult,
    habitsResult,
    habitLogsResult,
  ] =
    await Promise.all([
      supabase
        .from("blocks")
        .select("id, item_id, title, start_at, end_at, locked, done, reason")
        .eq("user_id", user.id)
        .lt("start_at", range.end.toISOString())
        .gt("end_at", range.start.toISOString())
        .order("start_at"),
      supabase
        .from("events")
        .select("id, source_id, title, location, start_at, end_at, all_day")
        .eq("user_id", user.id)
        .lt("start_at", range.end.toISOString())
        .gt("end_at", range.start.toISOString())
        .order("start_at"),
      supabase
        .from("items")
        .select("id, title, due_at, est_minutes, remaining_minutes")
        .eq("user_id", user.id)
        .eq("status", "open")
        .eq("is_project", false)
        .order("due_at"),
      supabase
        .from("blocks")
        .select("item_id")
        .eq("user_id", user.id)
        .eq("done", false)
        .not("item_id", "is", null),
      supabase
        .from("sources")
        .select("id, kind, label, enabled, last_synced_at")
        .eq("user_id", user.id)
        .eq("enabled", true)
        .order("label"),
      supabase
        .from("habits")
        .select("id, name, cadence, days_json, scheduled_time")
        .eq("user_id", user.id)
        .eq("archived", false)
        .not("scheduled_time", "is", null)
        .order("scheduled_time"),
      supabase
        .from("habit_logs")
        .select("habit_id, date, done")
        .eq("user_id", user.id)
        .gte("date", range.days[0])
        .lte("date", range.days[range.days.length - 1]),
    ]);

  const staleCutoff = staleCutoffMs();
  const staleSources = (sourcesResult.data ?? []).filter(
    (source) =>
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

  const errors = [
    blocksResult.error,
    eventsResult.error,
    itemsResult.error,
    liveBlocksResult.error,
    sourcesResult.error,
    habitsResult.error,
    habitLogsResult.error,
  ];
  if (errors.some(Boolean)) {
    return (
      <div className="app-page" data-page="calendar">
        <AppHeader />
        <p className="flex flex-1 items-center justify-center text-zinc-500">
          Could not load the calendar. Refresh to try again.
        </p>
      </div>
    );
  }

  const scheduledIds = new Set(
    (liveBlocksResult.data ?? []).flatMap((block) =>
      block.item_id ? [block.item_id] : [],
    ),
  );
  const completedHabitDates = new Set(
    (habitLogsResult.data ?? [])
      .filter((log) => log.done)
      .map((log) => `${log.habit_id}:${log.date}`),
  );
  const calendarHabits = buildHabitSchedule(
    range.days,
    (habitsResult.data ?? []).map((habit) => {
      const parsedDays = habitDaysSchema.safeParse(habit.days_json ?? []);
      return {
        id: habit.id,
        name: habit.name,
        cadence: habit.cadence,
        days: parsedDays.success ? parsedDays.data : [],
        scheduledTime: habit.scheduled_time?.slice(0, 5) ?? null,
      };
    }),
    completedHabitDates,
  );
  const previous = dateKey(addDays(anchor, -range.step));
  const next = dateKey(addDays(anchor, range.step));

  return (
    <div className="app-page" data-page="calendar">
      <AppHeader />
      <main className="calendar-page-shell flex flex-1 flex-col gap-4">
        <div className="page-intro">
          <div>
            <h1 className="page-title">Calendar</h1>
            <p className="calendar-range-label">{rangeLabel(query.view, anchor)}</p>
          </div>
          <div className="calendar-page-controls">
            <div className="segmented-control" aria-label="Change date range">
              <Link href={`/calendar?view=${query.view}&date=${previous}`} aria-label="Previous period">Previous</Link>
              <Link href={`/calendar?view=${query.view}`}>Today</Link>
              <Link href={`/calendar?view=${query.view}&date=${next}`} aria-label="Next period">Next</Link>
            </div>
            <div className="segmented-control" aria-label="Calendar view">
              {(["month", "week", "day"] as const).map((view) => (
                <Link
                  key={view}
                  href={`/calendar?view=${view}&date=${dateKey(anchor)}`}
                  data-active={view === query.view}
                >
                  {view[0].toUpperCase() + view.slice(1)}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <section className="neutral-panel calendar-panel">
          <CalendarBoard
            key={`${query.view}:${range.days[0]}:${(blocksResult.data ?? []).map((block) => `${block.id}:${block.start_at}:${block.end_at}:${block.locked}`).join("|")}:${calendarHabits.map((habit) => `${habit.id}:${habit.scheduledTime}:${habit.done}`).join("|")}`}
            view={query.view}
            days={range.days}
            blocks={(blocksResult.data ?? []).map((block) => ({
              id: block.id,
              itemId: block.item_id,
              title: block.title,
              startAt: block.start_at,
              endAt: block.end_at,
              locked: block.locked,
              done: block.done,
              reason: block.reason,
            }))}
            events={(eventsResult.data ?? []).map((event) => ({
              id: event.id,
              sourceId: event.source_id,
              title: event.title,
              location: event.location,
              startAt: event.start_at,
              endAt: event.end_at,
              allDay: event.all_day,
            }))}
            items={(itemsResult.data ?? [])
              .filter((item) => !scheduledIds.has(item.id))
              .map((item) => ({
                id: item.id,
                title: item.title,
                dueAt: item.due_at,
                estMinutes: item.est_minutes,
                remainingMinutes: item.remaining_minutes,
              }))}
            sources={sourcesResult.data ?? []}
            habits={calendarHabits}
          />
        </section>
      </main>
    </div>
  );
}
