import "server-only";

import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { readItemContext, writeItemContext } from "./item-context";
import {
  addItemInputSchema,
  applyPlanServiceInputSchema,
  blockProposalSchema,
  createNoteInputSchema,
  dateRangeSchema,
  decomposeProjectServiceInputSchema,
  habitDaysSchema,
  logHabitInputSchema,
  plannerPreferencesSchema,
  projectStepSchema,
  updateItemInputSchema,
  updateNoteInputSchema,
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
        "id, parent_id, title, description, course, due_at, priority, energy, est_minutes, remaining_minutes, actual_minutes, is_project, step_order, origin",
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
      .select("id, name, cadence, days_json, target_per_week, color, scheduled_time")
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
      item.due_at === null ||
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
    items: visibleItems.map((item) => {
      const context = readItemContext(item.description);
      return {
        ...item,
        description: context.description,
        source_url: context.sourceUrl,
        kind: item.is_project
          ? "project"
          : item.parent_id
            ? "project_step"
            : "task",
      };
    }),
    projects_without_steps: items
      .filter((item) => item.is_project && !childParents.has(item.id))
      .map((item) => {
        const context = readItemContext(item.description);
        return {
          ...item,
          description: context.description,
          source_url: context.sourceUrl,
        };
      }),
    events: eventsResult.data ?? [],
    protected_blocks: blocksResult.data ?? [],
    habits: dueHabits,
    planner_runs: runsResult.data ?? [],
  };
}

export async function applyPlan(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = applyPlanServiceInputSchema.safeParse(input);
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

  const writableDates = new Set(
    datesBetween(parsed.data.from_date, parsed.data.to_date).filter(
      (date) => parsed.data.scheduled_pass || !existingRuns.has(date),
    ),
  );
  const replaceableIds = (blocksResult.data ?? [])
    .filter(
      (block) =>
        block.origin === "ai" &&
        !block.locked &&
        !block.done &&
        writableDates.has(localParts(new Date(block.start_at), timeZone).date),
    )
    .map((block) => block.id);
  const runRows = [...writableDates].map((date) => ({
    plan_date: date,
    blocks_written: accepted.filter(
      (block) => localParts(new Date(block.start_at), timeZone).date === date,
    ).length,
    rejections_json: rejections,
  }));
  const { data: written, error: writeError } = await admin.rpc(
    "replace_ai_plan",
    {
      target_user_id: parsedUserId.data,
      replaceable_block_ids: replaceableIds,
      new_blocks: accepted as unknown as Json,
      run_rows: runRows as unknown as Json,
    },
  );
  if (writeError) {
    return {
      written: 0,
      rejected: [
        ...rejections,
        ...accepted.map((block) => ({
          block,
          why: "the atomic plan write failed",
        })),
      ],
    };
  }

  return { written: written ?? 0, rejected: rejections };
}

export async function addPlannerItem(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = addItemInputSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { error: "The item is not valid." };
  }
  const admin = createAdminClient();
  let learnedEstimate = parsed.data.est_minutes ?? null;
  if (learnedEstimate === null && parsed.data.course) {
    const { data: courseDefault } = await admin
      .from("course_defaults")
      .select("default_minutes")
      .eq("user_id", parsedUserId.data)
      .eq("course", parsed.data.course)
      .maybeSingle();
    learnedEstimate = courseDefault?.default_minutes ?? null;
  }
  const { data, error } = await admin
    .from("items")
    .insert({
      user_id: parsedUserId.data,
      title: parsed.data.title,
      description: writeItemContext(parsed.data.description, parsed.data.source_url),
      due_at: parsed.data.due_at ?? null,
      course: parsed.data.course ?? null,
      energy: parsed.data.energy,
      est_minutes: learnedEstimate,
      remaining_minutes: learnedEstimate,
      is_project: parsed.data.is_project,
      origin: "manual",
      status: "open",
    })
    .select(
      "id, title, description, due_at, est_minutes, course, energy, is_project",
    )
    .single();
  if (error || !data) return { error: "The item could not be added." };
  const context = readItemContext(data.description);
  return {
    item: {
      ...data,
      description: context.description,
      source_url: context.sourceUrl,
    },
  };
}

export async function updatePlannerItem(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = updateItemInputSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { error: "The item update is not valid." };
  }
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("items")
    .select("id, origin, actual_minutes, description")
    .eq("id", parsed.data.item_id)
    .eq("user_id", parsedUserId.data)
    .eq("status", "open")
    .maybeSingle();
  if (existingError || !existing) {
    return { error: "The open item was not found." };
  }
  if (existing.origin === "feed") {
    return { error: "Feed items are read-only and cannot be updated." };
  }

  const updates: {
    title?: string;
    description?: string | null;
    due_at?: string | null;
    est_minutes?: number | null;
    remaining_minutes?: number | null;
    course?: string | null;
    energy?: "low" | "medium" | "high";
  } = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (
    parsed.data.description !== undefined ||
    parsed.data.source_url !== undefined
  ) {
    const currentContext = readItemContext(existing.description);
    updates.description = writeItemContext(
      parsed.data.description !== undefined
        ? parsed.data.description
        : currentContext.description,
      parsed.data.source_url !== undefined
        ? parsed.data.source_url
        : currentContext.sourceUrl,
    );
  }
  if (parsed.data.due_at !== undefined) updates.due_at = parsed.data.due_at;
  if (parsed.data.course !== undefined) updates.course = parsed.data.course;
  if (parsed.data.energy !== undefined) updates.energy = parsed.data.energy;
  if (parsed.data.est_minutes !== undefined) {
    updates.est_minutes = parsed.data.est_minutes;
    updates.remaining_minutes =
      parsed.data.est_minutes === null
        ? null
        : Math.max(0, parsed.data.est_minutes - (existing.actual_minutes ?? 0));
  }

  const { data, error } = await admin
    .from("items")
    .update(updates)
    .eq("id", existing.id)
    .eq("user_id", parsedUserId.data)
    .eq("status", "open")
    .select(
      "id, title, description, due_at, est_minutes, remaining_minutes, course, energy, is_project",
    )
    .maybeSingle();
  if (error || !data) return { error: "The item could not be updated." };
  const context = readItemContext(data.description);
  return {
    item: {
      ...data,
      description: context.description,
      source_url: context.sourceUrl,
    },
  };
}

export async function createPlannerNote(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = createNoteInputSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { error: "The note is not valid." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notes")
    .insert({
      user_id: parsedUserId.data,
      title: parsed.data.title,
      body_md: parsed.data.body,
      pinned: parsed.data.pinned,
    })
    .select("id, title, pinned, updated_at")
    .single();
  return error || !data
    ? { error: "The note could not be created." }
    : { note: data };
}

export async function updatePlannerNote(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = updateNoteInputSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { error: "The note update is not valid." };
  }
  const updates: {
    title?: string;
    body_md?: string;
    pinned?: boolean;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.body !== undefined) updates.body_md = parsed.data.body;
  if (parsed.data.pinned !== undefined) updates.pinned = parsed.data.pinned;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notes")
    .update(updates)
    .eq("id", parsed.data.note_id)
    .eq("user_id", parsedUserId.data)
    .select("id, title, pinned, updated_at")
    .maybeSingle();
  return error || !data
    ? { error: "The note could not be updated." }
    : { note: data };
}

export async function decomposeProject(userId: string, input: unknown) {
  const parsedUserId = z.uuid().safeParse(userId);
  const parsed = decomposeProjectServiceInputSchema.safeParse(input);
  if (!parsedUserId.success || !parsed.success) {
    return { written: 0, rejected: [{ step: input, why: "invalid project input" }] };
  }
  const admin = createAdminClient();
  const [projectResult, stepsResult] = await Promise.all([
    admin
      .from("items")
      .select("id, due_at, is_project, status")
      .eq("id", parsed.data.project_id)
      .eq("user_id", parsedUserId.data)
      .maybeSingle(),
    admin
      .from("items")
      .select("id, origin, actual_minutes")
      .eq("parent_id", parsed.data.project_id)
      .eq("user_id", parsedUserId.data),
  ]);
  const project = projectResult.data;
  if (
    projectResult.error ||
    stepsResult.error ||
    !project ||
    !project.is_project ||
    project.status !== "open"
  ) {
    return { written: 0, rejected: [{ step: input, why: "project not found" }] };
  }

  const accepted = [];
  const rejected: { step: unknown; why: string }[] = [];
  const seenOrders = new Set<number>();
  for (const rawStep of parsed.data.steps) {
    const step = projectStepSchema.safeParse(rawStep);
    let why: string | null = null;
    if (!step.success) {
      why = step.error.issues[0]?.message ?? "invalid step";
    } else if (seenOrders.has(step.data.step_order)) {
      why = "step_order must be unique";
    } else if (
      project.due_at &&
      new Date(step.data.suggested_due) > new Date(project.due_at)
    ) {
      why = "suggested_due is after the project deadline";
    }
    if (why || !step.success) {
      rejected.push({ step: rawStep, why: why ?? "invalid step" });
    } else {
      seenOrders.add(step.data.step_order);
      accepted.push(step.data);
    }
  }
  if (accepted.length === 0) return { written: 0, rejected };

  const replaceableIds = (stepsResult.data ?? [])
    .filter(
      (step) => step.origin === "ai" && (step.actual_minutes ?? 0) === 0,
    )
    .map((step) => step.id);
  const { data: written, error } = await admin.rpc("replace_ai_project_steps", {
    target_user_id: parsedUserId.data,
    target_project_id: project.id,
    replaceable_step_ids: replaceableIds,
    new_steps: accepted as unknown as Json,
  });
  if (error) {
    return {
      written: 0,
      rejected: [
        ...rejected,
        ...accepted.map((step) => ({ step, why: "the atomic step write failed" })),
      ],
    };
  }
  return { written: written ?? 0, rejected };
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
