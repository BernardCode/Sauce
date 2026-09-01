import { z } from "zod";
import type { Json } from "@/lib/database.types";

const todayTaskOrderSchema = z.array(z.uuid()).max(500);
const laterItemIdsSchema = z.array(z.uuid()).max(500);
const postponedWorkKeywordsSchema = z
  .array(z.string().trim().min(1).max(50))
  .max(25);

export const DEFAULT_POSTPONED_WORK_KEYWORDS = ["essay", "essays", "sat"];

function jsonObject(
  value: Json | null,
): { [key: string]: Json | undefined } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

export function readTodayTaskOrder(value: Json | null): string[] {
  const result = todayTaskOrderSchema.safeParse(
    jsonObject(value).todayTaskOrder,
  );
  return result.success ? result.data : [];
}

export function readLaterItemIds(value: Json | null): string[] {
  const result = laterItemIdsSchema.safeParse(jsonObject(value).laterItemIds);
  return result.success ? result.data : [];
}

export function readPostponedWorkKeywords(value: Json | null): string[] {
  const result = postponedWorkKeywordsSchema.safeParse(
    jsonObject(value).postponedWorkKeywords,
  );
  return result.success ? result.data : DEFAULT_POSTPONED_WORK_KEYWORDS;
}

export function mergePlannerPreferences(
  current: Json | null,
  updates: Record<string, Json>,
): Json {
  return { ...jsonObject(current), ...updates };
}
