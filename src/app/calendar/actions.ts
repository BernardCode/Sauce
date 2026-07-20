"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveIcsSource } from "@/lib/calendar/ics";
import { syncCalendarSource } from "@/lib/calendar/sync-source";
import { createClient } from "@/lib/supabase/server";

const isoTime = z.iso.datetime({ offset: true });

const manualBlockSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    startAtIso: isoTime,
    endAtIso: isoTime,
  })
  .refine(
    (value) => new Date(value.endAtIso) > new Date(value.startAtIso),
    "A block has to end after it starts.",
  );

const sourceIdSchema = z.object({ id: z.uuid() });
const sourceEnabledSchema = sourceIdSchema.extend({ enabled: z.boolean() });
const icsSourceSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z.url().max(4_000),
});

type ActionResult = { error: string | null };

type ManualBlockResult = ActionResult & {
  block?: {
    id: string;
    itemId: null;
    title: string;
    startAt: string;
    endAt: string;
    locked: boolean;
    done: boolean;
    reason: null;
  };
};

export async function createManualBlock(input: unknown): Promise<ManualBlockResult> {
  const parsed = manualBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That block is not valid." };
  }
  const minutes =
    (new Date(parsed.data.endAtIso).getTime() -
      new Date(parsed.data.startAtIso).getTime()) /
    60_000;
  if (minutes > 12 * 60) return { error: "Blocks cap out at 12 hours." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { data, error } = await supabase
    .from("blocks")
    .insert({
      user_id: user.id,
      item_id: null,
      title: parsed.data.title,
      start_at: parsed.data.startAtIso,
      end_at: parsed.data.endAtIso,
      origin: "manual",
    })
    .select("id, title, start_at, end_at, locked, done")
    .single();
  if (error || !data) return { error: "Could not create that block. Try again." };

  revalidatePath("/calendar");
  revalidatePath("/today");
  return {
    error: null,
    block: {
      id: data.id,
      itemId: null,
      title: data.title,
      startAt: data.start_at,
      endAt: data.end_at,
      locked: data.locked,
      done: data.done,
      reason: null,
    },
  };
}

export async function syncSource(input: unknown): Promise<ActionResult> {
  const parsed = sourceIdSchema.safeParse(input);
  if (!parsed.success) return { error: "That source id is not valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data: source } = await supabase
    .from("sources")
    .select("id, kind")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .single();
  if (!source) return { error: "That source could not be found." };
  const result = await syncCalendarSource(source);
  revalidatePath("/calendar");
  revalidatePath("/settings");
  return result.ok ? { error: null } : { error: result.error };
}

export async function addIcsSource(input: unknown): Promise<ActionResult> {
  const parsed = icsSourceSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a valid feed label and URL." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const saved = await saveIcsSource({ userId: user.id, ...parsed.data });
  if (!saved.ok) return { error: saved.error };
  const synced = await syncCalendarSource({ id: saved.id, kind: "ics" });
  revalidatePath("/calendar");
  revalidatePath("/settings");
  revalidatePath("/today");
  return synced.ok ? { error: null } : { error: synced.error };
}

export async function deleteSource(input: unknown): Promise<ActionResult> {
  const parsed = sourceIdSchema.safeParse(input);
  if (!parsed.success) return { error: "That source id is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data: source } = await supabase
    .from("sources")
    .select("id, kind")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!source) return { error: "That source could not be found." };
  if (source.kind === "ics") {
    const { error: archiveError } = await supabase
      .from("items")
      .update({ status: "archived" })
      .eq("source_id", source.id)
      .eq("user_id", user.id)
      .eq("status", "open");
    if (archiveError) return { error: "Could not archive that feed's assignments." };
  }
  const { error } = await supabase
    .from("sources")
    .delete()
    .eq("id", source.id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not remove that source." };
  revalidatePath("/calendar");
  revalidatePath("/settings");
  revalidatePath("/today");
  return { error: null };
}

export async function setSourceEnabled(input: unknown): Promise<ActionResult> {
  const parsed = sourceEnabledSchema.safeParse(input);
  if (!parsed.success) return { error: "That source update is not valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data, error } = await supabase
    .from("sources")
    .update({ enabled: parsed.data.enabled })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not update that source." };

  revalidatePath("/calendar");
  revalidatePath("/settings");
  return { error: null };
}
