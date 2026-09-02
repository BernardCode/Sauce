"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  mergePlannerPreferences,
  readLaterItemIds,
} from "@/lib/planner/preferences";
import { localParts, safeTimeZone } from "@/lib/planner/time";
import { createClient } from "@/lib/supabase/server";
import type { AddItemResult } from "./task-types";

const optionalIsoTime = z.iso.datetime({ offset: true }).nullable().default(null);

const addItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "A task needs a title.")
      .max(500, "Keep titles under 500 characters."),
    dueAtIso: optionalIsoTime,
    plannedDate: z.iso.date().nullable().default(null),
    estMinutes: z
      .number()
      .int("The estimate must be whole minutes.")
      .positive("The estimate must be at least a minute.")
      .max(600, "Estimates cap out at 600 minutes.")
      .nullable(),
    isProject: z.boolean().default(false),
    course: z.string().trim().min(1).max(80).nullable().default(null),
    energy: z.enum(["low", "medium", "high"]).default("medium"),
    list: z.enum(["main", "later"]).default("main"),
    scheduledStartIso: optionalIsoTime,
  })
  .superRefine((value, context) => {
    if (value.scheduledStartIso && value.estMinutes === null) {
      context.addIssue({
        code: "custom",
        path: ["estMinutes"],
        message: "A scheduled task needs a duration.",
      });
    }
    if (value.scheduledStartIso && value.isProject) {
      context.addIssue({
        code: "custom",
        path: ["scheduledStartIso"],
        message: "Schedule a project step instead of the whole project.",
      });
    }
    if (value.scheduledStartIso && value.list === "later") {
      context.addIssue({
        code: "custom",
        path: ["scheduledStartIso"],
        message: "A Later task cannot also be scheduled for today.",
      });
    }
  });

const setItemDoneSchema = z.object({
  id: z.uuid("That item id is not valid."),
});

type ActionResult = { error: string | null; warning?: string | null };
type RolloverResult = ActionResult & { changed: boolean };

async function removeItemsFromLater(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemIds: string[],
): Promise<boolean> {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("planner_prefs_json")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) return false;
  const removedIds = new Set(itemIds);
  const currentLaterItemIds = readLaterItemIds(profile.planner_prefs_json);
  const laterItemIds = currentLaterItemIds.filter((id) => !removedIds.has(id));
  if (laterItemIds.length === currentLaterItemIds.length) return true;
  const { error } = await supabase
    .from("users")
    .update({
      planner_prefs_json: mergePlannerPreferences(
        profile.planner_prefs_json,
        { laterItemIds },
      ),
    })
    .eq("id", userId);
  return !error;
}

export async function rolloverUnfinishedItems(): Promise<RolloverResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "You are signed out. Refresh and sign in again.",
      changed: false,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", user.id)
    .single();
  if (profileError) {
    return { error: "Could not check earlier tasks.", changed: false };
  }

  const today = localParts(
    new Date(),
    safeTimeZone(profile?.timezone ?? "UTC"),
  ).date;
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("is_project", false)
    .neq("origin", "feed")
    .not("planned_date", "is", null)
    .lt("planned_date", today);
  if (itemsError) {
    return { error: "Could not check earlier tasks.", changed: false };
  }

  const itemIds = (items ?? []).map((item) => item.id);
  if (itemIds.length === 0) return { error: null, changed: false };

  const { error: plannedDateError } = await supabase
    .from("items")
    .update({ planned_date: today })
    .eq("user_id", user.id)
    .eq("status", "open")
    .in("id", itemIds);
  if (plannedDateError) {
    return { error: "Could not carry earlier tasks forward.", changed: false };
  }

  revalidatePath("/today");
  revalidatePath("/calendar");
  return { error: null, changed: true };
}

export async function addItem(input: unknown): Promise<AddItemResult> {
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That task could not be saved." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are signed out. Refresh and sign in again." };
  }

  const {
    title,
    dueAtIso,
    plannedDate,
    estMinutes,
    isProject,
    course,
    energy,
    list,
    scheduledStartIso,
  } = parsed.data;
  const isLater = list === "later" && !isProject;
  const { data: item, error } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      title,
      due_at: dueAtIso,
      planned_date: isProject || isLater ? null : plannedDate,
      est_minutes: estMinutes,
      // Remaining starts equal to the estimate; it drops as blocks complete.
      remaining_minutes: estMinutes,
      is_project: isProject,
      course,
      energy,
      origin: "manual",
      status: "open",
    })
    .select("id, title, course, due_at, planned_date, est_minutes, is_project, origin")
    .single();

  if (error || !item) {
    return { error: "Could not save the task. Try again." };
  }

  if (isLater) {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("planner_prefs_json")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      await supabase
        .from("items")
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id);
      return { error: "Could not add that task to Later. Try again." };
    }
    const laterItemIds = [
      ...readLaterItemIds(profile.planner_prefs_json),
      item.id,
    ].slice(-500);
    const { error: laterError } = await supabase
      .from("users")
      .update({
        planner_prefs_json: mergePlannerPreferences(
          profile.planner_prefs_json,
          { laterItemIds },
        ),
      })
      .eq("id", user.id);
    if (laterError) {
      await supabase
        .from("items")
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id);
      return { error: "Could not add that task to Later. Try again." };
    }
  }

  let warning: string | null = null;
  if (scheduledStartIso && estMinutes !== null) {
    const endAtIso = new Date(
      new Date(scheduledStartIso).getTime() + estMinutes * 60_000,
    ).toISOString();
    const { error: blockError } = await supabase.from("blocks").insert({
      user_id: user.id,
      item_id: item.id,
      title,
      start_at: scheduledStartIso,
      end_at: endAtIso,
      origin: "manual",
      reason: "Scheduled when the task was created.",
    });
    if (blockError) {
      warning = "Task saved, but it could not be added to Calendar.";
    } else {
      revalidatePath("/calendar");
    }
  }

  revalidatePath("/today");
  return {
    error: null,
    warning,
    item: {
      id: item.id,
      title: item.title,
      course: item.course,
      dueAt: item.due_at,
      plannedDate: item.planned_date,
      estMinutes: item.est_minutes,
      isProject: item.is_project,
      isLater,
      isOverdue: false,
      origin: item.origin,
    },
  };
}

const moveItemToListSchema = z.object({
  id: z.uuid("That item id is not valid."),
  destination: z.enum(["main", "later"]),
});

export async function moveItemToList(input: unknown): Promise<ActionResult> {
  const parsed = moveItemToListSchema.safeParse(input);
  if (!parsed.success) return { error: "That list change is not valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const [itemResult, profileResult] = await Promise.all([
    supabase
      .from("items")
      .select("id")
      .eq("id", parsed.data.id)
      .eq("user_id", user.id)
      .eq("status", "open")
      .eq("is_project", false)
      .maybeSingle(),
    supabase
      .from("users")
      .select("timezone, planner_prefs_json")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (itemResult.error || !itemResult.data) {
    return { error: "That open task could not be found." };
  }
  if (profileResult.error || !profileResult.data) {
    return { error: "Could not update your task lists." };
  }

  const previousLaterItemIds = readLaterItemIds(
    profileResult.data.planner_prefs_json,
  );
  const nextLaterItemIds =
    parsed.data.destination === "later"
      ? [...new Set([...previousLaterItemIds, parsed.data.id])].slice(-500)
      : previousLaterItemIds.filter((id) => id !== parsed.data.id);
  const nextPreferences = mergePlannerPreferences(
    profileResult.data.planner_prefs_json,
    { laterItemIds: nextLaterItemIds },
  );
  const { error: preferenceError } = await supabase
    .from("users")
    .update({ planner_prefs_json: nextPreferences })
    .eq("id", user.id);
  if (preferenceError) return { error: "Could not update your task lists." };

  const timeZone = safeTimeZone(profileResult.data.timezone);
  const today = localParts(new Date(), timeZone).date;
  const { error: itemError } = await supabase
    .from("items")
    .update({
      planned_date: parsed.data.destination === "main" ? today : null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("status", "open");
  if (itemError) {
    await supabase
      .from("users")
      .update({
        planner_prefs_json: mergePlannerPreferences(
          profileResult.data.planner_prefs_json,
          { laterItemIds: previousLaterItemIds },
        ),
      })
      .eq("id", user.id);
    return { error: "Could not update your task lists." };
  }

  let warning: string | null = null;
  if (parsed.data.destination === "later") {
    const { data: candidateBlocks, error: blocksError } = await supabase
      .from("blocks")
      .select("id, start_at")
      .eq("user_id", user.id)
      .eq("item_id", parsed.data.id)
      .eq("origin", "ai")
      .eq("locked", false)
      .eq("done", false);
    const todayBlockIds = (candidateBlocks ?? [])
      .filter(
        (block) => localParts(new Date(block.start_at), timeZone).date === today,
      )
      .map((block) => block.id);
    if (blocksError) {
      warning = "Moved to Later, but today's AI block could not be checked.";
    } else if (todayBlockIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("blocks")
        .delete()
        .eq("user_id", user.id)
        .in("id", todayBlockIds);
      if (deleteError) {
        warning = "Moved to Later, but today's AI block is still scheduled.";
      }
    }
  }

  revalidatePath("/today");
  revalidatePath("/calendar");
  return { error: null, warning };
}

const updateItemSchema = z.object({
  id: z.uuid("That item id is not valid."),
  title: z.string().trim().min(1).max(500),
  category: z.string().trim().max(100).nullable(),
  plannedDate: z.iso.date().nullable(),
  dueAtIso: optionalIsoTime,
  estMinutes: z
    .number()
    .int("The estimate must be whole minutes.")
    .positive("The estimate must be at least a minute.")
    .max(600, "Estimates cap out at 600 minutes.")
    .nullable(),
});

export async function updateItem(input: unknown): Promise<ActionResult> {
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That task update is not valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are signed out. Refresh and sign in again." };
  }

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, origin, actual_minutes, parent_id")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("is_project", false)
    .maybeSingle();
  if (itemError || !item) return { error: "That open task could not be found." };
  if (item.origin === "feed") return { error: "School feed tasks are read-only." };

  const { error } = await supabase
    .from("items")
    .update({
      title: parsed.data.title,
      course: parsed.data.category,
      planned_date: parsed.data.plannedDate,
      due_at: parsed.data.dueAtIso,
      est_minutes: parsed.data.estMinutes,
      remaining_minutes:
        parsed.data.estMinutes === null
          ? null
          : Math.max(0, parsed.data.estMinutes - (item.actual_minutes ?? 0)),
      origin: "manual",
    })
    .eq("id", item.id)
    .eq("user_id", user.id)
    .eq("status", "open");
  if (error) return { error: "Could not save that task. Try again." };

  revalidatePath("/today");
  revalidatePath("/calendar");
  if (item.parent_id) revalidatePath(`/projects/${item.parent_id}`);
  return { error: null };
}

export async function setItemDone(input: unknown): Promise<ActionResult> {
  const parsed = setItemDoneSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That item id is not valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are signed out. Refresh and sign in again." };
  }

  // RLS already scopes rows to the owner; matching user_id here as well
  // keeps the intent visible in the query itself.
  const { data: updatedItem, error } = await supabase
    .from("items")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("is_project", false)
    .select("id, parent_id")
    .maybeSingle();

  if (error || !updatedItem) {
    return { error: "Could not mark that done. Try again." };
  }
  // Per the spec, checking a card marks any block pointing at it done too.
  const { error: blocksError } = await supabase
    .from("blocks")
    .update({ done: true })
    .eq("item_id", updatedItem.id)
    .eq("user_id", user.id);
  if (blocksError) {
    revalidatePath("/today");
    return { error: "Marked done, but its scheduled blocks did not update." };
  }
  await removeItemsFromLater(supabase, user.id, [updatedItem.id]);

  if (updatedItem.parent_id) {
    const { count } = await supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", updatedItem.parent_id)
      .eq("user_id", user.id)
      .eq("status", "open");
    if (count === 0) {
      await supabase
        .from("items")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", updatedItem.parent_id)
        .eq("user_id", user.id)
        .eq("is_project", true);
    }
    revalidatePath(`/projects/${updatedItem.parent_id}`);
  }

  revalidatePath("/today");
  return { error: null };
}

const estimateSchema = z.object({
  id: z.uuid("That item id is not valid."),
  estMinutes: z
    .number()
    .int("The estimate must be whole minutes.")
    .positive("The estimate must be at least a minute.")
    .max(600, "Estimates cap out at 600 minutes.")
    .nullable(),
});

export async function updateItemEstimate(input: unknown): Promise<ActionResult> {
  const parsed = estimateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That estimate is not valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are signed out. Refresh and sign in again." };
  }

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, actual_minutes")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .single();
  if (itemError || !item) {
    return { error: "That task could not be found." };
  }

  const est = parsed.data.estMinutes;
  const { error } = await supabase
    .from("items")
    .update({
      est_minutes: est,
      // Remaining restarts from the new estimate minus work already logged.
      remaining_minutes:
        est === null ? null : Math.max(0, est - (item.actual_minutes ?? 0)),
    })
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (error) {
    return { error: "Could not save the estimate. Try again." };
  }

  revalidatePath("/today");
  return { error: null };
}
