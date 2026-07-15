"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const isoTime = z.iso.datetime({ offset: true, error: "That time is not valid." });

const MAX_BLOCK_MINUTES = 12 * 60;

const createBlockSchema = z.object({
  itemId: z.uuid("That item id is not valid."),
  startAtIso: isoTime,
  endAtIso: isoTime,
});

const updateTimesSchema = z.object({
  id: z.uuid("That block id is not valid."),
  startAtIso: isoTime,
  endAtIso: isoTime,
});

const idSchema = z.object({
  id: z.uuid("That block id is not valid."),
});

const lockSchema = z.object({
  id: z.uuid("That block id is not valid."),
  locked: z.boolean(),
});

const workSchema = z.object({
  id: z.uuid("That block id is not valid."),
  minutes: z
    .number()
    .int("Whole minutes only.")
    .positive("A work session is at least a minute.")
    .max(24 * 60, "That is more than a day of work."),
});

type ActionResult = { error: string | null };

function timesError(startAtIso: string, endAtIso: string): string | null {
  const minutes =
    (new Date(endAtIso).getTime() - new Date(startAtIso).getTime()) / 60_000;
  if (minutes <= 0) return "A block has to end after it starts.";
  if (minutes > MAX_BLOCK_MINUTES) return "Blocks cap out at 12 hours.";
  return null;
}

export async function createBlockForItem(input: unknown): Promise<ActionResult> {
  const parsed = createBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That block could not be created." };
  }
  const badTimes = timesError(parsed.data.startAtIso, parsed.data.endAtIso);
  if (badTimes) return { error: badTimes };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, title, status")
    .eq("id", parsed.data.itemId)
    .eq("user_id", user.id)
    .single();
  if (itemError || !item) return { error: "That task could not be found." };
  if (item.status !== "open") return { error: "Only open tasks can be scheduled." };

  const { error } = await supabase.from("blocks").insert({
    user_id: user.id,
    item_id: item.id,
    title: item.title,
    start_at: parsed.data.startAtIso,
    end_at: parsed.data.endAtIso,
    origin: "manual",
  });
  if (error) return { error: "Could not schedule that. Try again." };

  revalidatePath("/today");
  return { error: null };
}

export async function updateBlockTimes(input: unknown): Promise<ActionResult> {
  const parsed = updateTimesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Those times are not valid." };
  }
  const badTimes = timesError(parsed.data.startAtIso, parsed.data.endAtIso);
  if (badTimes) return { error: badTimes };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  // A human moved it, so the planner keeps its hands off from now on.
  const { error } = await supabase
    .from("blocks")
    .update({
      start_at: parsed.data.startAtIso,
      end_at: parsed.data.endAtIso,
      origin: "manual",
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not move that block. Try again." };

  revalidatePath("/today");
  return { error: null };
}

export async function deleteBlock(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That block id is not valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not remove that block. Try again." };

  revalidatePath("/today");
  return { error: null };
}

export async function setBlockLocked(input: unknown): Promise<ActionResult> {
  const parsed = lockSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That block id is not valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { error } = await supabase
    .from("blocks")
    .update({ locked: parsed.data.locked })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not update the lock. Try again." };

  revalidatePath("/today");
  return { error: null };
}

export async function recordBlockWork(input: unknown): Promise<ActionResult> {
  const parsed = workSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That session could not be saved." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, item_id, actual_minutes")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .single();
  if (blockError || !block) return { error: "That block could not be found." };

  const { error: blockUpdateError } = await supabase
    .from("blocks")
    .update({ actual_minutes: (block.actual_minutes ?? 0) + parsed.data.minutes })
    .eq("id", block.id)
    .eq("user_id", user.id);
  if (blockUpdateError) return { error: "Could not save that work session. Try again." };

  if (block.item_id) {
    const { data: item } = await supabase
      .from("items")
      .select("id, est_minutes, remaining_minutes, actual_minutes")
      .eq("id", block.item_id)
      .eq("user_id", user.id)
      .single();
    if (item) {
      // Remaining only counts down when an estimate ever existed; an
      // unestimated item has nothing meaningful to subtract from.
      const remainingBefore = item.remaining_minutes ?? item.est_minutes;
      await supabase
        .from("items")
        .update({
          actual_minutes: (item.actual_minutes ?? 0) + parsed.data.minutes,
          remaining_minutes:
            remainingBefore === null
              ? null
              : Math.max(0, remainingBefore - parsed.data.minutes),
        })
        .eq("id", item.id)
        .eq("user_id", user.id);
    }
  }

  revalidatePath("/today");
  return { error: null };
}
