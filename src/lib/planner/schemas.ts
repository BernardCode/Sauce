import { z } from "zod";
import { DEFAULT_POSTPONED_WORK_KEYWORDS } from "./preferences";

export const dateRangeSchema = z
  .object({
    from_date: z.iso.date(),
    to_date: z.iso.date(),
  })
  .refine((value) => value.to_date >= value.from_date, {
    message: "to_date must be on or after from_date",
  });

export const blockProposalSchema = z
  .object({
    item_id: z.uuid().describe("Sauce item id for a task or project step"),
    title: z.string().trim().min(1).max(500).describe("Schedule block title"),
    start_at: z
      .iso.datetime({ offset: true })
      .describe("Block start as an ISO 8601 timestamp with an offset"),
    end_at: z
      .iso.datetime({ offset: true })
      .describe("Block end as an ISO 8601 timestamp with an offset"),
    reason: z
      .string()
      .trim()
      .min(10)
      .max(500)
      .describe("One sentence explaining why this time was chosen"),
  })
  .refine((block) => new Date(block.end_at) > new Date(block.start_at), {
    message: "end before start",
  })
  .refine(
    (block) =>
      (new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) /
        60_000 <=
      180,
    { message: "block longer than 3 hours" },
  );

export const applyPlanInputSchema = z
  .object({
    from_date: z.iso.date(),
    to_date: z.iso.date(),
    blocks: z.array(blockProposalSchema).max(500),
    scheduled_pass: z.boolean().default(false),
  })
  .refine((value) => value.to_date >= value.from_date, {
    message: "to_date must be on or after from_date",
  });

// The MCP schema above must expose every nested field to clients. This service
// envelope stays permissive so malformed blocks can be rejected individually.
export const applyPlanServiceInputSchema = z
  .object({
    from_date: z.iso.date(),
    to_date: z.iso.date(),
    blocks: z.array(z.unknown()).max(500),
    scheduled_pass: z.boolean().default(false),
  })
  .refine((value) => value.to_date >= value.from_date, {
    message: "to_date must be on or after from_date",
  });

const categorySchema = z.string().trim().min(1).max(100);
const explicitUserConfirmationSchema = z
  .literal(true)
  .describe(
    "True only when the user explicitly requested this exact mutation in the current conversation",
  );

export const updateItemInputSchema = z
  .object({
    item_id: z.uuid(),
    confirmed_by_user: explicitUserConfirmationSchema,
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().trim().max(20_000).nullable().optional(),
    source_url: z
      .string()
      .trim()
      .max(2_048)
      .refine(isHttpUrl, "source_url must use http or https")
      .nullable()
      .optional(),
    due_at: z.iso.datetime({ offset: true }).nullable().optional(),
    planned_date: z.iso.date().nullable().optional(),
    est_minutes: z.number().int().positive().max(10_000).nullable().optional(),
    category: categorySchema.nullable().optional(),
    course: categorySchema.nullable().optional(),
    energy: z.enum(["low", "medium", "high"]).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.category !== undefined &&
      value.course !== undefined &&
      value.category !== value.course
    ) {
      context.addIssue({
        code: "custom",
        path: ["category"],
        message: "category and course must match when both are provided",
      });
    }
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) => key !== "item_id" && key !== "confirmed_by_user",
      ),
    "at least one item field is required",
  );

export const itemLifecycleInputSchema = z.object({
  item_id: z.uuid().describe("Sauce item id"),
  confirmed_by_user: explicitUserConfirmationSchema,
});

export const createNoteInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(200_000).default(""),
  pinned: z.boolean().default(false),
});

export const updateNoteInputSchema = z
  .object({
    note_id: z.uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().max(200_000).optional(),
    pinned: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "note_id"),
    "at least one note field is required",
  );

export const logHabitInputSchema = z.object({
  habit_id: z.uuid(),
  date: z.iso.date(),
});

export const workingHoursSchema = z
  .object({
    wake: z.number().int().min(0).max(23).default(7),
    sleep: z.number().int().min(1).max(24).default(23),
    blockedWindows: z
      .array(
        z.object({
          days: z.array(z.number().int().min(0).max(6)).min(1).optional(),
          start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        }),
      )
      .default([]),
  })
  .refine((value) => value.sleep > value.wake, {
    message: "sleep must be after wake",
  })
  .refine(
    (value) =>
      value.blockedWindows.every(
        (window) => clockValue(window.end) > clockValue(window.start),
      ),
    { message: "blocked windows must end after they start" },
  );

function clockValue(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const plannerPreferencesSchema = z.object({
  text: z.string().max(5000).default(""),
  postponedWorkKeywords: z
    .array(z.string().trim().min(1).max(50))
    .max(25)
    .default(DEFAULT_POSTPONED_WORK_KEYWORDS),
});

export const habitDaysSchema = z.array(z.number().int().min(0).max(6));

export type BlockProposal = z.infer<typeof blockProposalSchema>;
export type WorkingHours = z.infer<typeof workingHoursSchema>;
