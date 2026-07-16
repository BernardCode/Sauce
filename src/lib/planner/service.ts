import "server-only";

import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addItemInputSchema,
  applyPlanInputSchema,
  blockProposalSchema,
  dateRangeSchema,
  habitDaysSchema,
  logHabitInputSchema,
  plannerPreferencesSchema,
  workingHoursSchema,
  type BlockProposal,
} from "./schemas";
import {
  clockMinutes,
  intervalsOverlap,
  localParts,
  minutesBetween,
  safeTimeZone,
  utcRangeBounds,
} from "./time";

type Rejection = { block: unknown; why: string };

function habitIsDue(
  habit: { cadence: string; days_json: Json | null },
  date: string,
): boolean {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (habit.cadence === "daily") return true;
  if (habit.cadence === "weekdays") return weekday >= 1 && weekday <= 5;
  const days = habitDaysSchema.safeParse(habit.days_json);
  return days.success && days.data.includes(weekday);
}

function datesBetween(fromDate: string, toDate: string): string[] {
  const current = new Date(`${fromDate}T12:00:00Z`);
  const end = new Date(`${toDate}T12:00:00Z`);
  const dates: string[] = [];
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function getPlanningContext(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = dateRangeSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { error: "The planning range is not valid." };
  }
  const admin = createAdminClient();
  const { start, end } = utcRangeBounds(parsed.data.from_date, parsed.data.to_date);
  start.setUTCDate(start.getUTCDate() - 1);
  end.setUTCDate(end.getUTCDate() + 1);
  const lookahead = new Date(end);
  lookahead.setUTCDate(lookahead.getUTCDate() + 14);

  const [
    userResult,
    itemsResult,
    eventsResult,
    blocksResult,
    habitsResult,
    logsResult,
    runsResult,
  ] = await Promise.all([
    admin
      .from("users")
      .select("timezone, working_hours_json, planner_prefs_json")
      .eq("id", parsedUserId.data)
      .single(),
    admin
      .from("items")
      .select(
        "id, parent_id, title, course, due_at, priority, est_minutes, remaining_minutes, actual_minutes, is_project, step_order, origin",
      )
      .eq("user_id", parsedUserId.data)
      .eq("status", "open"),
    admin
      .from("events")
      .select("id, title, start_at, end_at, all_day")
      .eq("user_id", parsedUserId.data)
      .lt("start_at", end.toISOString())
      .gt("end_at", start.toISOString()),
    admin
      .from("blocks")
      .select("id, item_id, title, start_at, end_at, origin, locked, reason")
      .eq("user_id", parsedUserId.data)
      .eq("done", false)
      .lt("start_at", end.toISOString())
      .gt("end_at", start.toISOString())
      .or("locked.eq.true,origin.eq.manual"),
    admin
      .from("habits")
      .select("id, name, cadence, days_json, target_per_week, color")
      .eq("user_id", parsedUserId.data)
      .eq("archived", false),
    admin
      .from("habit_logs")
      .select("habit_id, date, done")
      .eq("user_id", parsedUserId.data)
      .gte("date", parsed.data.from_date)
      .lte("date", parsed.data.to_date),
    admin
      .from("planner_runs")
      .select("plan_date, ran_at")
      .eq("user_id", parsedUserId.data)
      .gte("plan_date", parsed.data.from_date)
      .lte("plan_date", parsed.data.to_date),
  ]);

  const firstError = [
    userResult.error,
    itemsResult.error,
    eventsResult.error,
    blocksResult.error,
    habitsResult.error,
    logsResult.error,
    runsResult.error,
  ].find(Boolean);
  if (firstError || !userResult.data) {
    return { error: "Planning context could not be loaded." };
  }

  const items = itemsResult.data ?? [];
  const childParents = new Set(
    items.flatMap((item) => (item.parent_id ? [item.parent_id] : [])),
  );
  const visibleItems = items.filter(
    (item) =>
      item.is_project ||
      (item.due_at !== null && new Date(item.due_at) <= lookahead),
  );
  const completedLogs = new Set(
    (logsResult.data ?? [])
      .filter((log) => log.done)
      .map((log) => `${log.habit_id}:${log.date}`),
  );
  const dueHabits = [];
  for (const date of datesBetween(parsed.data.from_date, parsed.data.to_date)) {
    for (const habit of habitsResult.data ?? []) {
      if (
        habitIsDue(habit, date) &&
        !completedLogs.has(`${habit.id}:${date}`)
      ) {
        dueHabits.push({ ...habit, date });
      }
    }
  }
  const workingHours = workingHoursSchema.safeParse(
    userResult.data.working_hours_json ?? {},
  );
  const preferences = plannerPreferencesSchema.safeParse(
    userResult.data.planner_prefs_json ?? {},
  );

  return {
    from_date: parsed.data.from_date,
    to_date: parsed.data.to_date,
    timezone: safeTimeZone(userResult.data.timezone),
    working_hours: workingHours.success
      ? workingHours.data
      : workingHoursSchema.parse({}),
    planner_preferences: preferences.success ? preferences.data.text : "",
    items: visibleItems.map((item) => ({
      ...item,
      kind: item.is_project
        ? "project"
        : item.parent_id
          ? "project_step"
          : "task",
    })),
    projects_without_steps: items.filter(
      (item) => item.is_project && !childParents.has(item.id),
    ),
    events: eventsResult.data ?? [],
    protected_blocks: blocksResult.data ?? [],
    habits: dueHabits,
    planner_runs: runsResult.data ?? [],
  };
}

export async function applyPlan(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = applyPlanInputSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { written: 0, rejected: [{ block: input, why: "invalid plan input" }] };
  }
  const admin = createAdminClient();
  const { start: queryStart, end: queryEnd } = utcRangeBounds(
    parsed.data.from_date,
    parsed.data.to_date,
  );
  queryStart.setUTCDate(queryStart.getUTCDate() - 1);
  queryEnd.setUTCDate(queryEnd.getUTCDate() + 1);
  const [userResult, itemsResult, eventsResult, blocksResult, runsResult] =
    await Promise.all([
      admin
        .from("users")
        .select("timezone, working_hours_json")
        .eq("id", parsedUserId.data)
        .single(),
      admin
        .from("items")
        .select("id, status, is_project, remaining_minutes, est_minutes")
        .eq("user_id", parsedUserId.data),
      admin
        .from("events")
        .select("start_at, end_at")
        .eq("user_id", parsedUserId.data)
        .lt("start_at", queryEnd.toISOString())
        .gt("end_at", queryStart.toISOString()),
      admin
        .from("blocks")
        .select("id, item_id, start_at, end_at, origin, locked, done")
        .eq("user_id", parsedUserId.data)
        .lt("start_at", queryEnd.toISOString())
        .gt("end_at", queryStart.toISOString()),
      admin
        .from("planner_runs")
        .select("plan_date")
        .eq("user_id", parsedUserId.data)
        .gte("plan_date", parsed.data.from_date)
        .lte("plan_date", parsed.data.to_date),
    ]);
  if (
    userResult.error ||
    itemsResult.error ||
    eventsResult.error ||
    blocksResult.error ||
    runsResult.error ||
    !userResult.data
  ) {
    return { written: 0, rejected: [{ block: input, why: "plan data unavailable" }] };
  }

  const timeZone = safeTimeZone(userResult.data.timezone);
  const hours = workingHoursSchema.safeParse(
    userResult.data.working_hours_json ?? {},
  );
  const workingHours = hours.success ? hours.data : workingHoursSchema.parse({});
  const items = new Map((itemsResult.data ?? []).map((item) => [item.id, item]));
  const existingRuns = new Set((runsResult.data ?? []).map((run) => run.plan_date));
  const protectedBlocks = (blocksResult.data ?? []).filter(
    (block) => block.locked || block.origin === "manual",
  );
  const rejections: Rejection[] = [];
  const accepted: BlockProposal[] = [];
  const scheduledMinutes = new Map<string, number>();
  for (const block of protectedBlocks) {
    if (!block.item_id) continue;
    scheduledMinutes.set(
      block.item_id,
      (scheduledMinutes.get(block.item_id) ?? 0) +
        minutesBetween(new Date(block.start_at), new Date(block.end_at)),
    );
  }

  for (const rawBlock of parsed.data.blocks) {
    const proposal = blockProposalSchema.safeParse(rawBlock);
    if (!proposal.success) {
      rejections.push({
        block: rawBlock,
        why: proposal.error.issues[0]?.message ?? "invalid block",
      });
      continue;
    }
    const block = proposal.data;
    const item = items.get(block.item_id);
    const start = new Date(block.start_at);
    const end = new Date(block.end_at);
    const localStart = localParts(start, timeZone);
    const localEnd = localParts(end, timeZone);
    let why: string | null = null;
    if (!item || item.status !== "open") why = "item is missing or not open";
    else if (item.is_project) why = "projects cannot be scheduled directly";
    else if (
      localStart.date < parsed.data.from_date ||
      localStart.date > parsed.data.to_date
    ) {
      why = "start is outside the planning horizon";
    } else if (
      !parsed.data.scheduled_pass &&
      existingRuns.has(localStart.date)
    ) {
      why = "date already has a planner run";
    } else if (
      localStart.date !== localEnd.date ||
      localStart.minutes < workingHours.wake * 60 ||
      localEnd.minutes > workingHours.sleep * 60
    ) {
      why = "block is outside working hours";
    } else if (
      workingHours.blockedWindows.some((window) => {
        if (window.days && !window.days.includes(localStart.weekday)) return false;
        const windowStart = clockMinutes(window.start);
        const windowEnd = clockMinutes(window.end);
        return localStart.minutes < windowEnd && localEnd.minutes > windowStart;
      })
    ) {
      why = "block overlaps a blocked window";
    } else if (
      (eventsResult.data ?? []).some((event) =>
        intervalsOverlap(
          { start, end },
          { start: new Date(event.start_at), end: new Date(event.end_at) },
        ),
      )
    ) {
      why = "block overlaps a calendar event";
    } else if (
      protectedBlocks.some((existing) =>
        intervalsOverlap(
          { start, end },
          { start: new Date(existing.start_at), end: new Date(existing.end_at) },
        ),
      )
    ) {
      why = "block overlaps a locked or manual block";
    } else if (
      accepted.some((existing) =>
        intervalsOverlap(
          { start, end },
          { start: new Date(existing.start_at), end: new Date(existing.end_at) },
        ),
      )
    ) {
      why = "block overlaps another proposed block";
    } else if (item) {
      const duration = minutesBetween(start, end);
      const total = (scheduledMinutes.get(item.id) ?? 0) + duration;
      const remaining = item.remaining_minutes ?? item.est_minutes;
      if (remaining !== null && total > remaining + 15) {
        why = "blocks exceed the item's remaining minutes";
      } else {
        scheduledMinutes.set(item.id, total);
      }
    }

    if (why) rejections.push({ block, why });
    else accepted.push(block);
  }

  const acceptedDates = new Set(
    accepted.map((block) => localParts(new Date(block.start_at), timeZone).date),
  );
  const replaceableIds = (blocksResult.data ?? [])
    .filter(
      (block) =>
        block.origin === "ai" &&
        !block.locked &&
        !block.done &&
        acceptedDates.has(localParts(new Date(block.start_at), timeZone).date),
    )
    .map((block) => block.id);
  if (replaceableIds.length > 0) {
    const { error } = await admin.from("blocks").delete().in("id", replaceableIds);
    if (error) {
      return {
        written: 0,
        rejected: [
          ...rejections,
          ...accepted.map((block) => ({ block, why: "old AI blocks could not be replaced" })),
        ],
      };
    }
  }

  let written = 0;
  for (const block of accepted) {
    const { error } = await admin.from("blocks").insert({
      user_id: parsedUserId.data,
      item_id: block.item_id,
      title: block.title,
      start_at: block.start_at,
      end_at: block.end_at,
      origin: "ai",
      locked: false,
      done: false,
      reason: block.reason,
    });
    if (error) rejections.push({ block, why: "block could not be written" });
    else written += 1;
  }

  for (const date of acceptedDates) {
    await admin.from("planner_runs").upsert(
      {
        user_id: parsedUserId.data,
        plan_date: date,
        ran_at: new Date().toISOString(),
        blocks_written: accepted.filter(
          (block) => localParts(new Date(block.start_at), timeZone).date === date,
        ).length,
        rejections_json: rejections as unknown as Json,
      },
      { onConflict: "user_id,plan_date" },
    );
  }

  return { written, rejected: rejections };
}

export async function addPlannerItem(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = addItemInputSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { error: "The item is not valid." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("items")
    .insert({
      user_id: parsedUserId.data,
      title: parsed.data.title,
      due_at: parsed.data.due_at ?? null,
      course: parsed.data.course ?? null,
      est_minutes: parsed.data.est_minutes ?? null,
      remaining_minutes: parsed.data.est_minutes ?? null,
      is_project: parsed.data.is_project,
      origin: "manual",
      status: "open",
    })
    .select("id, title, due_at, est_minutes, course, is_project")
    .single();
  return error || !data ? { error: "The item could not be added." } : { item: data };
}

export async function logPlannerHabit(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = logHabitInputSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { error: "The habit log is not valid." };
  }
  const admin = createAdminClient();
  const { data: habit } = await admin
    .from("habits")
    .select("id")
    .eq("id", parsed.data.habit_id)
    .eq("user_id", parsedUserId.data)
    .eq("archived", false)
    .single();
  if (!habit) return { error: "The habit could not be found." };
  const { error } = await admin.from("habit_logs").upsert(
    {
      user_id: parsedUserId.data,
      habit_id: habit.id,
      date: parsed.data.date,
      done: true,
    },
    { onConflict: "habit_id,date" },
  );
  return error ? { error: "The habit could not be logged." } : { logged: true };
}
