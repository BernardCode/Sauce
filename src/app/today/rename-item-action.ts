"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const renameItemSchema = z.object({
  id: z.uuid("That task id is not valid."),
  title: z
    .string()
    .trim()
    .min(1, "A task needs a title.")
    .max(500, "Keep titles under 500 characters."),
});

type ActionResult = { error: string | null };

export async function renameItem(input: unknown): Promise<ActionResult> {
  const parsed = renameItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "That title is not valid.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, origin, parent_id")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("is_project", false)
    .maybeSingle();
  if (itemError || !item) return { error: "That open task could not be found." };
  if (item.origin === "feed") return { error: "School feed tasks are read-only." };

  const { data: updatedItem, error: updateError } = await supabase
    .from("items")
    .update({ title: parsed.data.title, origin: "manual" })
    .eq("id", item.id)
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("is_project", false)
    .select("id")
    .maybeSingle();
  if (updateError || !updatedItem) {
    return { error: "Could not rename that task. Try again." };
  }

  revalidatePath("/today");
  revalidatePath("/calendar");
  if (item.parent_id) revalidatePath(`/projects/${item.parent_id}`);
  return { error: null };
}
