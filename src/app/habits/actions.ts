"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const habitSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    cadence: z.enum(["daily", "weekdays", "custom"]),
    days: z.array(z.number().int().min(0).max(6)).max(7),
    targetPerWeek: z.number().int().min(1).max(7),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    scheduledTime: z
      .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.null()])
      .default(null),
  })
  .refine((value) => value.cadence !== "custom" || value.days.length > 0, {
    message: "Custom habits need at least one day.",
  });

const logSchema = z.object({
  habitId: z.uuid(),
  date: z.iso.date(),
  done: z.boolean(),
});
const idSchema = z.object({ id: z.uuid() });
const scheduleSchema = idSchema.extend({
  scheduledTime: z.union([
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    z.null(),
  ]),
});
type ActionResult = { error: string | null };

function refreshHabits() {
  revalidatePath("/habits");
  revalidatePath("/calendar");
  revalidatePath("/today");
}

export async function createHabit(input: unknown): Promise<ActionResult> {
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That habit is not valid." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    name: parsed.data.name,
    cadence: parsed.data.cadence,
    days_json: parsed.data.days,
    target_per_week: parsed.data.targetPerWeek,
    color: parsed.data.color,
    scheduled_time: parsed.data.scheduledTime,
  });
  if (error) return { error: "Could not add that habit." };
  refreshHabits();
  return { error: null };
}

export async function setHabitScheduleTime(input: unknown): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { error: "That habit time is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data, error } = await supabase
    .from("habits")
    .update({ scheduled_time: parsed.data.scheduledTime })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("archived", false)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not update that habit time." };
  refreshHabits();
  return { error: null };
}

export async function setHabitLog(input: unknown): Promise<ActionResult> {
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { error: "That habit log is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data: habit } = await supabase
    .from("habits")
    .select("id")
    .eq("id", parsed.data.habitId)
    .eq("user_id", user.id)
    .eq("archived", false)
    .maybeSingle();
  if (!habit) return { error: "That habit could not be found." };
  const { error } = await supabase.from("habit_logs").upsert(
    {
      user_id: user.id,
      habit_id: habit.id,
      date: parsed.data.date,
      done: parsed.data.done,
    },
    { onConflict: "habit_id,date" },
  );
  if (error) return { error: "Could not update that habit." };
  refreshHabits();
  return { error: null };
}

export async function archiveHabit(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That habit id is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { error } = await supabase
    .from("habits")
    .update({ archived: true })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not archive that habit." };
  refreshHabits();
  return { error: null };
}
