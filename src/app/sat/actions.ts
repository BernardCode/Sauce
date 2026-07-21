"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  SAT_TEST_DATES,
  SAT_TEST_DATE_VALUES,
} from "@/lib/sat/test-dates";
import { createClient } from "@/lib/supabase/server";

const screenshotSchema = z
  .instanceof(File)
  .refine((file) => file.size <= 5 * 1024 * 1024, {
    message: "The screenshot must be 5 MB or smaller.",
  })
  .refine(
    (file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type),
    { message: "Use a PNG, JPEG, or WebP screenshot." },
  );

const mistakeSchema = z.object({
  reflection: z.string().trim().min(1).max(2000),
  screenshot: screenshotSchema.optional(),
});

const reviewSchema = z.object({ id: z.uuid(), outcome: z.enum(["again", "resolved"]) });
const testDatesSchema = z.object({
  testDates: z
    .array(z.iso.date())
    .min(1)
    .max(SAT_TEST_DATES.length)
    .refine(
      (dates) => new Set(dates).size === dates.length,
      "Choose each SAT date once.",
    )
    .refine(
      (dates) => dates.every((date) => SAT_TEST_DATE_VALUES.has(date)),
      "Choose dates from the official SAT schedule.",
    ),
});
const practiceTestSchema = z
  .object({
    testDate: z.iso.date(),
    totalScore: z.number().int().min(400).max(1600),
    mathScore: z.number().int().min(200).max(800),
    readingWritingScore: z.number().int().min(200).max(800),
  })
  .refine(
    (value) =>
      value.totalScore === value.mathScore + value.readingWritingScore,
    { message: "The section scores must add up to the total score." },
  );
type ActionResult = { error: string | null };

async function owner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function refreshSat() {
  revalidatePath("/sat");
  revalidatePath("/sat/review");
  revalidatePath("/today");
  revalidatePath("/review");
}

export async function saveSatTestDates(input: unknown): Promise<ActionResult> {
  const parsed = testDatesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Those SAT test dates are not valid.",
    };
  }
  const { supabase, user } = await owner();
  if (!user) return { error: "You are signed out." };
  const testDates = [...parsed.data.testDates].sort();
  const { error } = await supabase.from("sat_profiles").upsert({
    user_id: user.id,
    test_date: testDates[0],
    test_dates: testDates,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save your SAT test dates." };
  refreshSat();
  return { error: null };
}

export async function logSatPracticeTest(
  input: unknown,
): Promise<ActionResult> {
  const parsed = practiceTestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "That practice test score is not valid.",
    };
  }
  const { supabase, user } = await owner();
  if (!user) return { error: "You are signed out." };
  const { error } = await supabase.from("sat_practice_tests").insert({
    user_id: user.id,
    test_date: parsed.data.testDate,
    total_score: parsed.data.totalScore,
    math_score: parsed.data.mathScore,
    reading_writing_score: parsed.data.readingWritingScore,
  });
  if (error) return { error: "Could not save that practice test score." };
  refreshSat();
  return { error: null };
}

export async function addSatMistake(input: unknown): Promise<ActionResult> {
  if (!(input instanceof FormData)) {
    return { error: "That mistake note is not valid." };
  }
  const rawScreenshot = input.get("screenshot");
  const screenshot =
    rawScreenshot instanceof File && rawScreenshot.size > 0
      ? rawScreenshot
      : undefined;
  const parsed = mistakeSchema.safeParse({
    reflection: input.get("reflection"),
    screenshot,
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "That mistake note is not valid.",
    };
  }
  const { supabase, user } = await owner();
  if (!user) return { error: "You are signed out." };

  let screenshotPath: string | null = null;
  if (parsed.data.screenshot) {
    const extensionByType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    screenshotPath = `${user.id}/${crypto.randomUUID()}.${extensionByType[parsed.data.screenshot.type]}`;
    const { error: uploadError } = await supabase.storage
      .from("sat-mistakes")
      .upload(screenshotPath, parsed.data.screenshot, {
        contentType: parsed.data.screenshot.type,
        upsert: false,
      });
    if (uploadError) return { error: "Could not upload that screenshot." };
  }

  const review = new Date();
  review.setDate(review.getDate() + 4);
  const { error } = await supabase.from("sat_mistakes").insert({
    user_id: user.id,
    section: null,
    skill: null,
    reason: parsed.data.reflection,
    takeaway: "",
    confidence: 2,
    source_url: null,
    screenshot_path: screenshotPath,
    next_review_at: review.toISOString().slice(0, 10),
  });
  if (error) {
    if (screenshotPath) {
      await supabase.storage.from("sat-mistakes").remove([screenshotPath]);
    }
    return { error: "Could not add that mistake to review." };
  }
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
