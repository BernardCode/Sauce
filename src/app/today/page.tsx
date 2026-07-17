import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppHeader } from "@/app/components/app-header";
import { syncCalendarSource } from "@/lib/calendar/sync-source";
import { createClient } from "@/lib/supabase/server";
import { isProjectAtRisk } from "@/lib/projects/risk";
import { habitIsDue } from "@/lib/habits/due";
import {
  habitDaysSchema,
  workingHoursSchema,
  type WorkingHours,
} from "@/lib/planner/schemas";
import { localParts, safeTimeZone } from "@/lib/planner/time";
import Link from "next/link";
import { DayRail } from "./day-rail";
import { ItemList, type TodayItem } from "./item-list";
import type { TodayBlock, TodayEvent } from "./types";
import { TodayHabits } from "./today-habits";
import { QuickNote } from "./quick-note";
import { UpNext } from "./up-next";
import { TodayWorkspace } from "./today-workspace";
import { StudentBriefing } from "./student-briefing";
import { MissedWork } from "./missed-work";
import { SmartAlerts } from "./smart-alerts";

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

function previousDate(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function workingCapacityMinutes(
  from: { date: string; minutes: number },
  to: { date: string; minutes: number },
  hours: WorkingHours,
): number {
  const cursor = new Date(`${from.date}T12:00:00.000Z`);
  const endDate = new Date(`${to.date}T12:00:00.000Z`);
  let capacity = 0;
  while (cursor <= endDate) {
    const date = cursor.toISOString().slice(0, 10);
    const weekday = cursor.getUTCDay();
    const start = date === from.date
      ? Math.max(hours.wake * 60, from.minutes)
      : hours.wake * 60;
    const end = date === to.date
      ? Math.min(hours.sleep * 60, to.minutes)
      : hours.sleep * 60;
    let dayCapacity = Math.max(0, end - start);
    for (const window of hours.blockedWindows) {
      if (window.days && !window.days.includes(weekday)) continue;
      const [startHour, startMinute] = window.start.split(":").map(Number);
      const [endHour, endMinute] = window.end.split(":").map(Number);
      const blockedStart = startHour * 60 + startMinute;
      const blockedEnd = endHour * 60 + endMinute;
      dayCapacity -= Math.max(
        0,
        Math.min(end, blockedEnd) - Math.max(start, blockedStart),
      );
    }
    capacity += Math.max(0, dayCapacity);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return capacity;
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
  const staleSources = (sources ?? [])
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
  const plannerHours = parsedHours.success
    ? parsedHours.data
    : workingHoursSchema.parse({});
  const wakeHour = plannerHours.wake;
  const sleepHour = plannerHours.sleep;

  const nowMs = requestTimeMs();
  const timeZone = safeTimeZone(userResult.data?.timezone ?? "UTC");
  const localToday = localParts(
    new Date(nowMs),
    timeZone,
  );
  const expectedPlanDate =
    localToday.minutes >= 6 * 60
      ? localToday.date
      : previousDate(localToday.date);
  const { data: expectedPlanRun } = await supabase
    .from("planner_runs")
    .select("plan_date")
    .eq("user_id", user.id)
    .eq("plan_date", expectedPlanDate)
    .maybeSingle();
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
  const { data: dailyNote } = await supabase
    .from("notes")
    .select("body_md")
    .eq("user_id", user.id)
    .eq("daily_date", localToday.date)
    .maybeSingle();
  const { count: satReviews } = await supabase
    .from("sat_mistakes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("resolved", false)
    .lte("next_review_at", localToday.date);
  const latestProjectDeadline = Math.max(
    nowMs,
    ...[...projects.values()].flatMap((project) =>
      project.due_at ? [new Date(project.due_at).getTime()] : [],
    ),
  );
  const { data: riskEventRows } = await supabase
    .from("events")
    .select(eventColumns)
    .eq("user_id", user.id)
    .lt("start_at", new Date(latestProjectDeadline).toISOString())
    .gt("end_at", new Date(nowMs).toISOString());
  const riskEvents = (riskEventRows ?? []).map(toTodayEvent);
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
    const deadlineLocal = localParts(new Date(deadlineMs), timeZone);
    const baseCapacity = workingCapacityMinutes(
      { date: localToday.date, minutes: localToday.minutes },
      { date: deadlineLocal.date, minutes: deadlineLocal.minutes },
      plannerHours,
    );
    const busyMinutes = riskEvents.reduce(
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
  const dueSoon = openItems.filter((item) => item.dueAt && new Date(item.dueAt).getTime() >= nowMs && new Date(item.dueAt).getTime() <= nowMs + 86_400_000).length;
  const overdue = openItems.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < nowMs).length;
  const plannedMinutes = Math.round(blocks.filter((block) => !block.done && localParts(new Date(block.startAt), timeZone).date === localToday.date).reduce((sum, block) => sum + (new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) / 60_000, 0));
  const missedBlocks = blocks.filter((block) => !block.done && new Date(block.endAt).getTime() < nowMs);
  const nextLiveBlock = blocks.filter((block) => !block.done && new Date(block.endAt).getTime() > nowMs).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] ?? null;

  return (
    <div className="app-page" data-page="today">
      <AppHeader />
      <SmartAlerts overdue={overdue} nextBlockStart={nextLiveBlock?.startAt ?? null} nextBlockTitle={nextLiveBlock?.title ?? null} atRisk={atRiskProjects.length} />
      <main className="flex flex-1 flex-col">
        {loadError ? (
          <p className="flex flex-1 items-center justify-center text-zinc-500">
            Could not load your items. Refresh to try again.
          </p>
        ) : (
          <>
          <div className="page-intro mb-2">
            <div>
              <p className="page-kicker">Daily plan</p>
              <h1 className="page-title">Today</h1>
              <p className="page-description">Choose the next useful block, then keep moving.</p>
            </div>
            <div className="app-context-hint">
              Drag a task to schedule it
            </div>
          </div>
          <StudentBriefing overdue={overdue} dueSoon={dueSoon} plannedMinutes={plannedMinutes} satReviews={satReviews ?? 0} />
          {!expectedPlanRun ? (
            <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              The planner has not recorded its expected run. Your existing schedule is unchanged.
            </p>
          ) : null}
          <div className="pt-6">
            <TodayWorkspace
              schedule={
              <DayRail
                blocks={blocks}
                events={events}
                wakeHour={wakeHour}
                sleepHour={sleepHour}
                itemDueDates={itemDueDates}
              />
              }
              focus={
              <>
              <UpNext blocks={blocks} />
              <MissedWork initialBlocks={missedBlocks.map((block) => ({ id: block.id, title: block.title, startAt: block.startAt, endAt: block.endAt }))} />
              <TodayHabits
                date={localToday.date}
                habits={dueHabits.map((habit) => ({
                  id: habit.id,
                  name: habit.name,
                  color: habit.color,
                  done: doneHabitIds.has(habit.id),
                }))}
              />
              <QuickNote
                date={localToday.date}
                initialBody={dailyNote?.body_md ?? ""}
              />
              <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
                <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">At risk</h2><span className="rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">Projects</span></div>
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
                  <p className="mt-2 text-sm text-[var(--muted)]">Everything fits before its deadline.</p>
                )}
              </section>
              </>
              }
              tasks={
              <ItemList
                openItems={openItems}
                doneItems={doneItems}
                blocks={blocks}
              />
              }
            />
          </div>
          </>
        )}
      </main>
    </div>
  );
}
