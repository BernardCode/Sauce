import { z } from "zod";

const parameterValueSchema = z.union([
  z.string().max(200_000),
  z.object({ val: z.string().max(200_000) }).passthrough(),
]);

const componentSchema = z
  .object({
    type: z.enum(["VEVENT", "VTODO"]),
    uid: z.string().trim().min(1).max(1_000),
    summary: parameterValueSchema.optional(),
    description: parameterValueSchema.optional(),
    start: z.date().optional(),
    due: z.date().optional(),
    end: z.date().optional(),
    status: z.string().optional(),
    priority: z.number().int().min(0).max(9).optional(),
  })
  .passthrough();

function parameterText(value: z.infer<typeof parameterValueSchema> | undefined) {
  return typeof value === "string" ? value : value?.val;
}

export function toIcsItemCandidate(raw: unknown) {
  const parsed = componentSchema.safeParse(raw);
  if (!parsed.success) return null;
  const component = parsed.data;
  if (
    component.status === "CANCELLED" ||
    component.status === "COMPLETED"
  ) {
    return null;
  }
  const due = component.due ?? component.start ?? component.end;
  if (!due || !Number.isFinite(due.getTime())) return null;
  const numericPriority = component.priority ?? 0;
  const priority = numericPriority > 0 && numericPriority <= 3
    ? "high"
    : numericPriority >= 7
      ? "low"
      : "normal";
  return {
    externalId: component.uid,
    title: (parameterText(component.summary)?.trim() || "Untitled assignment").slice(0, 500),
    description: parameterText(component.description)?.trim().slice(0, 200_000) || null,
    dueAt: due.toISOString(),
    priority,
  };
}
