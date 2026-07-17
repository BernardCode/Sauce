"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const addItemSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "A task needs a title.")
    .max(500, "Keep titles under 500 characters."),
  dueAtIso: z
    .iso
    .datetime({ offset: true, error: "That due date is not valid." })
    .nullable(),
  estMinutes: z
    .number()
    .int("The estimate must be whole minutes.")
    .positive("The estimate must be at least a minute.")
    .max(600, "Estimates cap out at 600 minutes.")
    .nullable(),
  isProject: z.boolean().default(false),
  course: z.string().trim().min(1).max(80).nullable().default(null),
  energy: z.enum(["low", "medium", "high"]).default("medium"),
});

const setItemDoneSchema = z.object({
  id: z.uuid("That item id is not valid."),
});

type ActionResult = { error: string | null };

export async function addItem(input: unknown): Promise<ActionResult> {
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

  const { title, dueAtIso, estMinutes, isProject, course, energy } = parsed.data;
  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    title,
    due_at: dueAtIso,
    est_minutes: estMinutes,
    // Remaining starts equal to the estimate; it drops as blocks complete.
    remaining_minutes: estMinutes,
    is_project: isProject,
    course,
    energy,
    origin: "manual",
    status: "open",
  });

  if (error) {
    return { error: "Could not save the task. Try again." };
  }

  revalidatePath("/today");
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
