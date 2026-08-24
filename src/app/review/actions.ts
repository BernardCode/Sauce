"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const restoreItemSchema = z.object({
  id: z.uuid("That task id is not valid."),
});

type ActionResult = { error: string | null };

export async function restoreCompletedItem(
  input: unknown,
): Promise<ActionResult> {
  const parsed = restoreItemSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That task is not valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are signed out. Refresh and sign in again." };
  }

  const { data: restoredItem, error } = await supabase
    .from("items")
    .update({ status: "open", completed_at: null })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("status", "done")
    .eq("is_project", false)
    .select("id, parent_id")
    .maybeSingle();
  if (error || !restoredItem) {
    return { error: "That completed task could not be restored." };
  }

  if (restoredItem.parent_id) {
    await supabase
      .from("items")
      .update({ status: "open", completed_at: null })
      .eq("id", restoredItem.parent_id)
      .eq("user_id", user.id)
      .eq("status", "done")
      .eq("is_project", true);
    revalidatePath(`/projects/${restoredItem.parent_id}`);
  }

  revalidatePath("/review");
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/projects");
  return { error: null };
}
