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
    location: parameterValueSchema.optional(),
    categories: z.array(z.string().trim().min(1).max(1_000)).max(100).optional(),
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

function dateOnlyStamp(date: Date): string | null {
  const icsDate = date as Date & { dateOnly?: boolean };
  return icsDate.dateOnly ? date.toISOString().slice(0, 10) : null;
}

const genericSchoologyCategories = new Set([
  "assignment",
  "assignments",
  "assessment",
  "discussion",
  "event",
  "events",
  "homework",
  "quiz",
  "schoology",
  "test",
  "public",
  "private",
  "confidential",
]);

function cleanCourse(value: string | undefined): string | null {
  const course = value?.replace(/\s+/g, " ").trim();
  if (
    !course ||
    genericSchoologyCategories.has(course.toLowerCase()) ||
    /^https?:\/\//i.test(course)
  ) {
    return null;
  }
  return course.slice(0, 100);
}

function parameterTextFromUnknown(value: unknown): string | undefined {
  const parsed = parameterValueSchema.safeParse(value);
  return parsed.success ? parameterText(parsed.data) : undefined;
}

function customSchoologyCourse(component: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(component)) {
    const normalizedKey = key
      .toLowerCase()
      .replace(/^x-/, "")
      .replaceAll("_", "-");
    const isDirectCourseField = [
      "calendar",
      "calendar-name",
      "course",
      "course-name",
      "section",
      "section-name",
      "section-title",
    ].includes(normalizedKey);
    const isSchoologyCourseField =
      normalizedKey.includes("schoology") &&
      /(?:^|-)(?:course|class|section|calendar)(?:-|$)/.test(normalizedKey);
    const namesCourse = isDirectCourseField || isSchoologyCourseField;
    if (!namesCourse) continue;
    const course = cleanCourse(parameterTextFromUnknown(value));
    if (course) return course;
  }
  return null;
}

function descriptionCourse(description: string | undefined): string | null {
  if (!description) return null;
  for (const line of description.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:course(?:\s+name)?|class|section(?:\s+name)?|calendar)\s*[:=-]\s*(.+?)\s*$/i,
    );
    const course = cleanCourse(match?.[1]);
    if (course) return course;
  }
  return null;
}

function schoologyCourse(
  component: z.infer<typeof componentSchema>,
): string | null {
  const explicitCourse = customSchoologyCourse(component);
  if (explicitCourse) return explicitCourse;

  const describedCourse = descriptionCourse(parameterText(component.description));
  if (describedCourse) return describedCourse;

  for (const category of component.categories ?? []) {
    const course = cleanCourse(category);
    if (course) return course;
  }

  return cleanCourse(parameterText(component.location));
}

type IcsCandidateOptions = {
  inferSchoologyCourse?: boolean;
};

export function toIcsItemCandidate(
  raw: unknown,
  options: IcsCandidateOptions = {},
) {
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
    course: options.inferSchoologyCourse ? schoologyCourse(component) : null,
    dueDate: dateOnlyStamp(due),
    dueAt: due.toISOString(),
    priority,
  };
}
