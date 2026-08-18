import { z } from "zod";
import type { Json } from "@/lib/database.types";

const todayTaskOrderSchema = z.array(z.uuid()).max(500);

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

export function mergePlannerPreferences(
  current: Json | null,
  updates: Record<string, Json>,
): Json {
  return { ...jsonObject(current), ...updates };
}
