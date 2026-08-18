"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { workingHoursSchema } from "@/lib/planner/schemas";
import { mergePlannerPreferences } from "@/lib/planner/preferences";
import { safeTimeZone } from "@/lib/planner/time";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  timezone: z.string().trim().min(1).max(100),
  workingHours: workingHoursSchema,
  plannerPreferences: z.string().trim().max(5000),
});

const courseDefaultSchema = z.object({
  course: z.string().trim().min(1).max(100),
  defaultMinutes: z.number().int().positive().max(10_000),
});

type ActionResult = { error: string | null };

export async function updatePlannerSettings(input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success || safeTimeZone(parsed.data.timezone) !== parsed.data.timezone) {
    return { error: "Those planner settings are not valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("planner_prefs_json")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Could not save planner settings." };
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      timezone: parsed.data.timezone,
      working_hours_json: parsed.data.workingHours as unknown as Json,
      planner_prefs_json: mergePlannerPreferences(profile.planner_prefs_json, {
        text: parsed.data.plannerPreferences,
      }),
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not save planner settings." };

  revalidatePath("/settings");
  revalidatePath("/today");
  return { error: null };
}

export async function updateCourseDefault(input: unknown): Promise<ActionResult> {
  const parsed = courseDefaultSchema.safeParse(input);
  if (!parsed.success) return { error: "That course default is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data: existing } = await supabase
    .from("course_defaults")
    .select("sample_count")
    .eq("user_id", user.id)
    .eq("course", parsed.data.course)
    .maybeSingle();
  const { error } = await supabase.from("course_defaults").upsert(
    {
      user_id: user.id,
      course: parsed.data.course,
      default_minutes: parsed.data.defaultMinutes,
      sample_count: existing?.sample_count ?? 0,
    },
    { onConflict: "user_id,course", ignoreDuplicates: false },
  );
  if (error) return { error: "Could not save that course default." };
  revalidatePath("/settings");
  return { error: null };
}
