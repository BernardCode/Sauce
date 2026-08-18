"use server";

import { z } from "zod";
import {
  mergePlannerPreferences,
  readTodayTaskOrder,
} from "@/lib/planner/preferences";
import { createClient } from "@/lib/supabase/server";
import { applySavedOrder } from "./reorder";

const itemIdsSchema = z
  .array(z.uuid("That task order contains an invalid id."))
  .max(500, "Too many tasks were included in that order.")
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "That task order contains duplicates.",
  });

const loadOrderSchema = z.object({ itemIds: itemIdsSchema });
const saveOrderSchema = z.object({ orderedItemIds: itemIdsSchema });

type LoadOrderResult = {
  error: string | null;
  orderedItemIds: string[];
};

type ActionResult = { error: string | null };

export async function loadTodayTaskOrder(
  input: unknown,
): Promise<LoadOrderResult> {
  const parsed = loadOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "That task order is not valid.", orderedItemIds: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "You are signed out. Refresh and sign in again.",
      orderedItemIds: parsed.data.itemIds,
    };
  }

  const { data: profile, error } = await supabase
    .from("users")
    .select("planner_prefs_json")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile) {
    return {
      error: "Could not load your task order.",
      orderedItemIds: parsed.data.itemIds,
    };
  }

  return {
    error: null,
    orderedItemIds: applySavedOrder(
      parsed.data.itemIds,
      readTodayTaskOrder(profile.planner_prefs_json),
    ),
  };
}

export async function reorderTodayTasks(input: unknown): Promise<ActionResult> {
  const parsed = saveOrderSchema.safeParse(input);
  if (!parsed.success) return { error: "That task order is not valid." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const orderedItemIds = parsed.data.orderedItemIds;
  if (orderedItemIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "open")
      .eq("is_project", false)
      .in("id", orderedItemIds);
    if (itemsError || items?.length !== orderedItemIds.length) {
      return { error: "That task list changed. Refresh and try again." };
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("planner_prefs_json")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Could not save your task order." };
  }

  const previousOrder = readTodayTaskOrder(profile.planner_prefs_json);
  const visibleIds = new Set(orderedItemIds);
  const retainedIds = previousOrder.filter((id) => !visibleIds.has(id));
  const combinedOrder = [...orderedItemIds, ...retainedIds].slice(0, 500);
  const plannerPreferences = mergePlannerPreferences(
    profile.planner_prefs_json,
    {
      todayTaskOrder: combinedOrder,
    },
  );
  const { data: updatedProfile, error: updateError } = await supabase
    .from("users")
    .update({ planner_prefs_json: plannerPreferences })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (updateError || !updatedProfile) {
    return { error: "Could not save your task order." };
  }

  return { error: null };
}
