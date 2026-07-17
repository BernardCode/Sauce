"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseQuickAdd } from "@/lib/quick-add/parse";

const updateAssignmentSchema = z.object({
  id: z.uuid(),
  course: z.string().trim().max(80).nullable(),
  energy: z.enum(["low", "medium", "high"]),
  priority: z.enum(["low", "normal", "high"]),
});

const progressSchema = z.object({
  id: z.uuid(),
  minutes: z.number().int().min(1).max(1440),
});

type ActionResult = { error: string | null };
type BulkActionResult = ActionResult & { created: number };

function revalidateAssignments() {
  revalidatePath("/assignments");
  revalidatePath("/today");
  revalidatePath("/focus");
  revalidatePath("/review");
}

export async function updateAssignment(input: unknown): Promise<ActionResult> {
  const parsed = updateAssignmentSchema.safeParse(input);
  if (!parsed.success) return { error: "Those assignment details are not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { error } = await supabase
    .from("items")
    .update({
      course: parsed.data.course,
      energy: parsed.data.energy,
      priority: parsed.data.priority,
      origin: "manual",
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not update that assignment." };
  revalidateAssignments();
  return { error: null };
}

export async function recordItemProgress(input: unknown): Promise<ActionResult> {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return { error: "That work session is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { error } = await supabase.rpc("record_item_progress", {
    item_id_arg: parsed.data.id,
    work_minutes: parsed.data.minutes,
  });
  if (error) return { error: "Could not save that progress." };
  revalidateAssignments();
  return { error: null };
}

const bulkSchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  course: z.string().trim().max(80).nullable(),
});

export async function bulkAddAssignments(input: unknown): Promise<BulkActionResult> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { error: "Paste one assignment per line.", created: 0 };
  const lines = parsed.data.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 100);
  const rows = lines.map((line) => parseQuickAdd(line)).filter((item) => item.title).map((item) => ({ title: item.title, due_at: item.dueAt?.toISOString() ?? null, est_minutes: item.estMinutes, remaining_minutes: item.estMinutes, is_project: item.isProject ?? false, course: parsed.data.course, energy: "medium", origin: "manual", status: "open" }));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out.", created: 0 };
  const { error } = await supabase.from("items").insert(rows.map((row) => ({ ...row, user_id: user.id })));
  if (error) return { error: "Could not import those assignments.", created: 0 };
  revalidateAssignments();
  return { error: null, created: rows.length };
}
