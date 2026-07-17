"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const noteSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(200_000),
  pinned: z.boolean(),
});
const createSchema = z.object({ title: z.string().trim().min(1).max(200) });
const idSchema = z.object({ id: z.uuid() });
const dailySchema = z.object({ date: z.iso.date() });
const dailySaveSchema = dailySchema.extend({ body: z.string().max(200_000) });
type ActionResult = { error: string | null; id?: string };

function refreshNotes() {
  revalidatePath("/notes");
  revalidatePath("/today");
}

export async function createNote(input: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: "A note needs a title." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: user.id, title: parsed.data.title })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create that note." };
  refreshNotes();
  return { error: null, id: data.id };
}

export async function updateNote(input: unknown): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: "That note is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data, error } = await supabase
    .from("notes")
    .update({
      title: parsed.data.title,
      body_md: parsed.data.body,
      pinned: parsed.data.pinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not save that note." };
  refreshNotes();
  return { error: null };
}

export async function deleteNote(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That note id is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { error } = await supabase.from("notes").delete().eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return { error: "Could not delete that note." };
  refreshNotes();
  return { error: null };
}

export async function ensureDailyNote(input: unknown): Promise<ActionResult> {
  const parsed = dailySchema.safeParse(input);
  if (!parsed.success) return { error: "That daily note date is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data, error } = await supabase.from("notes").upsert(
    {
      user_id: user.id,
      title: `Daily note ${parsed.data.date}`,
      daily_date: parsed.data.date,
    },
    { onConflict: "user_id,daily_date", ignoreDuplicates: true },
  ).select("id").maybeSingle();
  if (error) return { error: "Could not prepare today's note." };
  return { error: null, id: data?.id };
}

export async function saveDailyNote(input: unknown): Promise<ActionResult> {
  const parsed = dailySaveSchema.safeParse(input);
  if (!parsed.success) return { error: "That daily note is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { error } = await supabase.from("notes").upsert(
    {
      user_id: user.id,
      title: `Daily note ${parsed.data.date}`,
      daily_date: parsed.data.date,
      body_md: parsed.data.body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,daily_date" },
  );
  if (error) return { error: "Could not save today's note." };
  revalidatePath("/notes");
  return { error: null };
}
