import { z } from "zod";

const safeNextPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\") &&
      !value.includes("\0"),
  );

export function parseSafeNextPath(value: unknown) {
  const parsed = safeNextPathSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
