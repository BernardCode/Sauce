import { redirect } from "next/navigation";
import { z } from "zod";
import { AppHeader } from "@/app/components/app-header";
import { syncGoogleCalendarSource } from "@/lib/calendar/google";
import { createClient } from "@/lib/supabase/server";
import { DayRail } from "./day-rail";
import { ItemList, type TodayItem } from "./item-list";
import type { TodayBlock, TodayEvent } from "./types";

type ItemRow = {
  id: string;
  title: string;
  course: string | null;
  due_at: string | null;
  completed_at: string | null;
  est_minutes: number | null;
  remaining_minutes: number | null;
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

// Working hours stored in users.working_hours_json as plain hour numbers,
// for example { "wake": 7, "sleep": 23 }. Blocked-out windows arrive with
// the planner milestones.
const workingHoursSchema = z.object({
  wake: z.number().int().min(0).max(23).optional(),
  sleep: z.number().int().min(1).max(24).optional(),
});

// Deliberately impure, so they live outside the component body: both
// cutoffs have to track the wall clock on every request.
function doneCutoffIso(): string {
  return new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
}

function blocksCutoffIso(): string {
  // 36 hours back keeps a spanning-midnight block visible in every
  // timezone; the query has no upper bound so future badges load too.
  return new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
}

function eventsWindowIso(): { start: string; end: string } {
  return {
    start: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    end: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };
}

function staleSourceCutoffMs(): number {
  return Date.now() - 15 * 60 * 1000;
}

function toTodayItem(row: ItemRow): TodayItem {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    estMinutes: row.est_minutes,
    remainingMinutes: row.remaining_minutes,
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

const itemColumns =
  "id, title, course, due_at, completed_at, est_minutes, remaining_minutes";
const blockColumns =
  "id, item_id, title, start_at, end_at, origin, locked, done, reason, actual_minutes";
const eventColumns = "id, title, start_at, end_at, all_day";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already guards this route; this is defense in depth.
  if (!user) {
    redirect("/");
  }

  const doneCutoff = doneCutoffIso();
  const blocksCutoff = blocksCutoffIso();
  const eventsWindow = eventsWindowIso();

  const { data: sources } = await supabase
    .from("sources")
    .select("id, kind, enabled, last_synced_at")
    .eq("user_id", user.id);
  const staleCutoff = staleSourceCutoffMs();
  await Promise.allSettled(
    (sources ?? [])
      .filter(
        (source) =>
          source.enabled &&
          source.kind === "gcal" &&
          (!source.last_synced_at ||
            new Date(source.last_synced_at).getTime() < staleCutoff),
      )
      .map((source) => syncGoogleCalendarSource(source.id)),
  );

  const [openResult, doneResult, blocksResult, eventsResult, userResult] =
    await Promise.all([
    supabase
      .from("items")
      .select(itemColumns)
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("due_at", { ascending: true }),
    supabase
      .from("items")
      .select(itemColumns)
      .eq("user_id", user.id)
      .eq("status", "done")
      .gte("completed_at", doneCutoff)
      .order("completed_at", { ascending: false }),
    supabase
      .from("blocks")
      .select(blockColumns)
      .eq("user_id", user.id)
      .gte("end_at", blocksCutoff)
      .order("start_at", { ascending: true }),
    supabase
      .from("events")
      .select(eventColumns)
      .eq("user_id", user.id)
      .lt("start_at", eventsWindow.end)
      .gt("end_at", eventsWindow.start)
      .order("start_at", { ascending: true }),
    supabase
      .from("users")
      .select("working_hours_json")
      .eq("id", user.id)
      .single(),
    ]);

  const loadError =
    openResult.error ??
    doneResult.error ??
    blocksResult.error ??
    eventsResult.error;
  const openItems = (openResult.data ?? []).map(toTodayItem);
  const doneItems = (doneResult.data ?? []).map(toTodayItem);
  const blocks = (blocksResult.data ?? []).map(toTodayBlock);
  const events = (eventsResult.data ?? []).map(toTodayEvent);

  // A missing or malformed working-hours blob just falls back to defaults.
  const parsedHours = workingHoursSchema.safeParse(
    userResult.data?.working_hours_json ?? {},
  );
  const wakeHour = parsedHours.success ? (parsedHours.data.wake ?? 7) : 7;
  const sleepHour = parsedHours.success ? (parsedHours.data.sleep ?? 23) : 23;

  // The block popover shows the linked item's due date.
  const itemDueDates: Record<string, string | null> = {};
  for (const item of openItems) {
    itemDueDates[item.id] = item.dueAt;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6">
      <AppHeader />
      <main className="flex flex-1 flex-col">
        {loadError ? (
          <p className="flex flex-1 items-center justify-center text-zinc-500">
            Could not load your items. Refresh to try again.
          </p>
        ) : (
          <div className="flex flex-1 flex-col gap-8 pt-6 lg:flex-row">
            <section
              aria-label="Schedule"
              className="order-2 lg:order-1 lg:w-80 lg:shrink-0"
            >
              <DayRail
                blocks={blocks}
                events={events}
                wakeHour={wakeHour}
                sleepHour={sleepHour}
                itemDueDates={itemDueDates}
              />
            </section>
            <section
              aria-label="Todo list"
              className="order-1 flex flex-1 flex-col lg:order-2"
            >
              <ItemList
                openItems={openItems}
                doneItems={doneItems}
                blocks={blocks}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
