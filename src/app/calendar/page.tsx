import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { AppHeader } from "@/app/components/app-header";
import { syncCalendarSource } from "@/lib/calendar/sync-source";
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

  const { data: initialSources } = await supabase
    .from("sources")
    .select("id, kind, label, enabled, last_synced_at")
    .eq("user_id", user.id)
    .order("label");
  const staleCutoff = staleCutoffMs();
  const staleSources = (initialSources ?? [])
    .filter(
        (source) =>
          source.enabled &&
          ["gcal", "ics"].includes(source.kind) &&
          (!source.last_synced_at ||
            new Date(source.last_synced_at).getTime() < staleCutoff),
      );
  if (staleSources.length) {
    after(async () => {
      await Promise.allSettled(staleSources.map((source) => syncCalendarSource(source)));
    });
  }

  const [blocksResult, eventsResult, itemsResult, liveBlocksResult, sourcesResult] =
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
        .select("id, label, enabled")
        .eq("user_id", user.id)
        .eq("enabled", true)
        .order("label"),
    ]);

  const errors = [blocksResult.error, eventsResult.error, itemsResult.error, sourcesResult.error];
  if (errors.some(Boolean)) {
    return (
      <div className="app-page">
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
  const previous = dateKey(addDays(anchor, -range.step));
  const next = dateKey(addDays(anchor, range.step));

  return (
    <div className="app-page">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-4">
        <div className="page-intro">
          <div><p className="page-kicker">See where your time is going</p><h1 className="page-title">Calendar</h1><p className="page-description">Events are fixed commitments. Work blocks are yours to move, resize, lock, or remove.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="segmented-control">
            <Link href={`/calendar?view=${query.view}&date=${previous}`} aria-label="Previous period">Previous</Link>
            <Link href={`/calendar?view=${query.view}`}>Today</Link>
            <Link href={`/calendar?view=${query.view}&date=${next}`} aria-label="Next period">Next</Link>
            </div>
            <div className="segmented-control">
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
        <div className="workspace-card flex flex-1 flex-col"><CalendarBoard
          key={`${query.view}:${range.days[0]}:${(blocksResult.data ?? []).map((block) => `${block.id}:${block.start_at}:${block.end_at}:${block.locked}`).join("|")}`}
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
        /></div>
      </main>
    </div>
  );
}
