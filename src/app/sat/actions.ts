"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  testDate: z.iso.date().nullable(),
  targetScore: z.number().int().min(400).max(1600),
  currentScore: z.number().int().min(400).max(1600).nullable(),
  weeklyMinutes: z.number().int().min(30).max(2100),
});

const sessionSchema = z.object({
  section: z.enum(["math", "reading_writing"]),
  skill: z.string().trim().min(1).max(120),
  mode: z.enum(["timed", "untimed", "review"]),
  minutes: z.number().int().min(1).max(600),
  questions: z.number().int().min(1).max(200),
  correct: z.number().int().min(0).max(200),
}).refine((value) => value.correct <= value.questions, { message: "Correct answers cannot exceed questions." });

const mistakeSchema = z.object({
  section: z.enum(["math", "reading_writing"]),
  skill: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(500),
  takeaway: z.string().trim().max(1000),
  confidence: z.number().int().min(1).max(5),
  sourceUrl: z.union([z.url(), z.literal("")]),
});

const reviewSchema = z.object({ id: z.uuid(), outcome: z.enum(["again", "resolved"]) });
type ActionResult = { error: string | null };

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function refreshSat() {
  revalidatePath("/sat");
  revalidatePath("/today");
  revalidatePath("/review");
}

export async function saveSatProfile(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Those SAT goals are not valid." };
  const { supabase, user } = await owner();
  if (!user) return { error: "You are signed out." };
  const { error } = await supabase.from("sat_profiles").upsert({ user_id: user.id, test_date: parsed.data.testDate, target_score: parsed.data.targetScore, current_score: parsed.data.currentScore, weekly_minutes: parsed.data.weeklyMinutes, updated_at: new Date().toISOString() });
  if (error) return { error: "Could not save your SAT goals." };
  refreshSat();
  return { error: null };
}

export async function logSatSession(input: unknown): Promise<ActionResult> {
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That practice session is not valid." };
  const { supabase, user } = await owner();
  if (!user) return { error: "You are signed out." };
  const { error } = await supabase.from("sat_sessions").insert({ user_id: user.id, section: parsed.data.section, skill: parsed.data.skill, mode: parsed.data.mode, minutes: parsed.data.minutes, questions: parsed.data.questions, correct: parsed.data.correct });
  if (error) return { error: "Could not save that practice session." };
  refreshSat();
  return { error: null };
}

export async function addSatMistake(input: unknown): Promise<ActionResult> {
  const parsed = mistakeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That mistake note is not valid." };
  const { supabase, user } = await owner();
  if (!user) return { error: "You are signed out." };
  const review = new Date();
  review.setDate(review.getDate() + (6 - parsed.data.confidence));
  const { error } = await supabase.from("sat_mistakes").insert({ user_id: user.id, section: parsed.data.section, skill: parsed.data.skill, reason: parsed.data.reason, takeaway: parsed.data.takeaway, confidence: parsed.data.confidence, source_url: parsed.data.sourceUrl || null, next_review_at: review.toISOString().slice(0, 10) });
  if (error) return { error: "Could not add that mistake to review." };
  refreshSat();
  return { error: null };
}

export async function reviewSatMistake(input: unknown): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: "That review update is not valid." };
  const { supabase, user } = await owner();
  if (!user) return { error: "You are signed out." };
  const next = new Date();
  next.setDate(next.getDate() + 7);
  const { error } = await supabase.from("sat_mistakes").update({ resolved: parsed.data.outcome === "resolved", next_review_at: next.toISOString().slice(0, 10) }).eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return { error: "Could not update that review item." };
  refreshSat();
  return { error: null };
}
