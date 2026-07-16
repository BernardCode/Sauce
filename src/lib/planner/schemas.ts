import { z } from "zod";

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
    item_id: z.uuid(),
    title: z.string().trim().min(1).max(500),
    start_at: z.iso.datetime({ offset: true }),
    end_at: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(10).max(500),
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
    blocks: z.array(z.unknown()).max(500),
    scheduled_pass: z.boolean().default(false),
  })
  .refine((value) => value.to_date >= value.from_date, {
    message: "to_date must be on or after from_date",
  });

export const addItemInputSchema = z.object({
  title: z.string().trim().min(1).max(500),
  due_at: z.iso.datetime({ offset: true }).optional(),
  est_minutes: z.number().int().positive().max(10_000).optional(),
  course: z.string().trim().min(1).max(100).optional(),
  is_project: z.boolean().default(false),
});

export const logHabitInputSchema = z.object({
  habit_id: z.uuid(),
  date: z.iso.date(),
});

export const workingHoursSchema = z.object({
  wake: z.number().int().min(0).max(23).default(7),
  sleep: z.number().int().min(1).max(24).default(23),
  blockedWindows: z
    .array(
      z.object({
        days: z.array(z.number().int().min(0).max(6)).optional(),
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
    )
    .default([]),
});

export const plannerPreferencesSchema = z.object({
  text: z.string().max(5000).default(""),
});

export const habitDaysSchema = z.array(z.number().int().min(0).max(6));

export type BlockProposal = z.infer<typeof blockProposalSchema>;
