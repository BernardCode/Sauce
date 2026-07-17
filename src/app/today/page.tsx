import { redirect } from "next/navigation";
import { z } from "zod";
import { AppHeader } from "@/app/components/app-header";
import { syncGoogleCalendarSource } from "@/lib/calendar/google";
import { createClient } from "@/lib/supabase/server";
import { isProjectAtRisk } from "@/lib/projects/risk";
import { habitIsDue } from "@/lib/habits/due";
import { habitDaysSchema } from "@/lib/planner/schemas";
import { localParts, safeTimeZone } from "@/lib/planner/time";
import Link from "next/link";
import { DayRail } from "./day-rail";
import { ItemList, type TodayItem } from "./item-list";
import type { TodayBlock, TodayEvent } from "./types";
import { TodayHabits } from "./today-habits";

type ItemRow = {
  id: string;
  title: string;
  course: string | null;
  due_at: string | null;
  completed_at: string | null;
  est_minutes: number | null;
  remaining_minutes: number | null;
  actual_minutes: number | null;
  is_project: boolean;
  parent_id: string | null;
  status: string;
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

function requestTimeMs(): number {
  return Date.now();
}

function overlapMinutes(
  startAt: string,
  endAt: string,
  horizonStart: number,
  horizonEnd: number,
): number {
  const start = Math.max(horizonStart, new Date(startAt).getTime());
  const end = Math.min(horizonEnd, new Date(endAt).getTime());
  return Math.max(0, (end - start) / 60_000);
}

function toTodayItem(
  row: ItemRow,
  projects: Map<string, ItemRow>,
  children: Map<string, ItemRow[]>,
): TodayItem {
  const projectChildren = children.get(row.id) ?? [];
  const totalEstimate = projectChildren.reduce(
    (sum, step) => sum + (step.est_minutes ?? 0),
    0,
  );
  const totalActual = projectChildren.reduce(
    (sum, step) => sum + (step.actual_minutes ?? 0),
    0,
  );
  const stepsDone = projectChildren.filter((step) => step.status === "done").length;
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    estMinutes: row.est_minutes,
    remainingMinutes: row.remaining_minutes,
    isProject: row.is_project,
    parentTitle: row.parent_id ? (projects.get(row.parent_id)?.title ?? "Project") : null,
    stepsDone,
    stepsTotal: projectChildren.length,
    progressPercent:
      totalEstimate > 0
        ? Math.min(100, Math.round((totalActual / totalEstimate) * 100))
        : projectChildren.length > 0
          ? Math.round((stepsDone / projectChildren.length) * 100)
          : 0,
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
  "id, title, course, due_at, completed_at, est_minutes, remaining_minutes, actual_minutes, is_project, parent_id, status";
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

  const [openResult, doneResult, projectItemsResult, blocksResult, eventsResult, userResult, habitsResult] =
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
      .from("items")
      .select(itemColumns)
      .eq("user_id", user.id)
      .or("is_project.eq.true,parent_id.not.is.null"),
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
      .select("timezone, working_hours_json")
      .eq("id", user.id)
      .single(),
    supabase
      .from("habits")
      .select("id, name, cadence, days_json, color")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("name"),
    ]);

  const loadError =
    openResult.error ??
    doneResult.error ??
    projectItemsResult.error ??
    blocksResult.error ??
    eventsResult.error ??
    habitsResult.error;
  const projectRows = (projectItemsResult.data ?? []) as ItemRow[];
  const projects = new Map(
    projectRows.filter((item) => item.is_project).map((item) => [item.id, item]),
  );
  const children = new Map<string, ItemRow[]>();
  for (const item of projectRows) {
    if (!item.parent_id) continue;
    children.set(item.parent_id, [...(children.get(item.parent_id) ?? []), item]);
  }
  const openItems = ((openResult.data ?? []) as ItemRow[]).map((item) =>
    toTodayItem(item, projects, children),
  );
  const doneItems = ((doneResult.data ?? []) as ItemRow[]).map((item) =>
    toTodayItem(item, projects, children),
  );
  const blocks = (blocksResult.data ?? []).map(toTodayBlock);
  const events = (eventsResult.data ?? []).map(toTodayEvent);

  // A missing or malformed working-hours blob just falls back to defaults.
  const parsedHours = workingHoursSchema.safeParse(
    userResult.data?.working_hours_json ?? {},
  );
  const wakeHour = parsedHours.success ? (parsedHours.data.wake ?? 7) : 7;
  const sleepHour = parsedHours.success ? (parsedHours.data.sleep ?? 23) : 23;

  const nowMs = requestTimeMs();
  const localToday = localParts(
    new Date(nowMs),
    safeTimeZone(userResult.data?.timezone ?? "UTC"),
  );
  const dueHabits = (habitsResult.data ?? []).filter((habit) => {
    const parsedDays = habitDaysSchema.safeParse(habit.days_json ?? []);
    return habitIsDue(
      habit.cadence,
      parsedDays.success ? parsedDays.data : [],
      localToday.weekday,
    );
  });
  const { data: todayHabitLogs } = dueHabits.length
    ? await supabase
        .from("habit_logs")
        .select("habit_id, done")
        .eq("user_id", user.id)
        .eq("date", localToday.date)
        .in("habit_id", dueHabits.map((habit) => habit.id))
    : { data: [] };
  const doneHabitIds = new Set(
    (todayHabitLogs ?? []).filter((log) => log.done).map((log) => log.habit_id),
  );
  const atRiskProjects = [...projects.values()].filter((project) => {
    if (!project.due_at || project.status !== "open") return false;
    const deadlineMs = new Date(project.due_at).getTime();
    const projectChildren = children.get(project.id) ?? [];
    const openChildren = projectChildren.filter((step) => step.status === "open");
    const childIds = new Set(projectChildren.map((step) => step.id));
    const remainingMinutes = openChildren.reduce(
      (sum, step) => sum + (step.remaining_minutes ?? step.est_minutes ?? 0),
      0,
    );
    const days = Math.max(0, Math.ceil((deadlineMs - nowMs) / 86_400_000));
    const baseCapacity = days * Math.max(0, sleepHour - wakeHour) * 60;
    const busyMinutes = events.reduce(
      (sum, event) =>
        sum + overlapMinutes(event.startAt, event.endAt, nowMs, deadlineMs),
      0,
    ) + blocks
      .filter((block) => !block.itemId || !childIds.has(block.itemId))
      .reduce(
        (sum, block) =>
          sum + overlapMinutes(block.startAt, block.endAt, nowMs, deadlineMs),
        0,
      );
    return isProjectAtRisk({
      nowMs,
      deadlineMs,
      remainingMinutes,
      availableMinutes: baseCapacity - busyMinutes,
      scheduledEndTimesMs: blocks
        .filter((block) => block.itemId && childIds.has(block.itemId))
        .map((block) => new Date(block.endAt).getTime()),
    });
  });

  // The block popover shows the linked item's due date.
  const itemDueDates: Record<string, string | null> = {};
  for (const item of openItems) {
    itemDueDates[item.id] = item.dueAt;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-6">
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
            <aside className="order-3 flex flex-col gap-4 lg:w-64 lg:shrink-0">
              <TodayHabits
                date={localToday.date}
                habits={dueHabits.map((habit) => ({
                  id: habit.id,
                  name: habit.name,
                  color: habit.color,
                  done: doneHabitIds.has(habit.id),
                }))}
              />
              <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h2 className="text-sm font-medium">At risk</h2>
                {atRiskProjects.length ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {atRiskProjects.map((project) => (
                      <li key={project.id}>
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-sm text-red-700 hover:underline dark:text-red-300"
                        >
                          {project.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">No projects at risk.</p>
                )}
              </section>
            </aside>
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
