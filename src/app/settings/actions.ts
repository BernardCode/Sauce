"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { workingHoursSchema } from "@/lib/planner/schemas";
import { safeTimeZone } from "@/lib/planner/time";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  timezone: z.string().trim().min(1).max(100),
  workingHours: workingHoursSchema,
  plannerPreferences: z.string().trim().max(5000),
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

  const { data, error } = await supabase
    .from("users")
    .update({
      timezone: parsed.data.timezone,
      working_hours_json: parsed.data.workingHours as unknown as Json,
      planner_prefs_json: {
        text: parsed.data.plannerPreferences,
      } satisfies Json,
    })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Could not save planner settings." };

  revalidatePath("/settings");
  revalidatePath("/today");
  return { error: null };
}
