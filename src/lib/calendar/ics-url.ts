import { z } from "zod";

const icsFeedUrlInputSchema = z.string().trim().min(1).max(4_000);

export function normalizeIcsFeedUrl(input: unknown): URL | null {
  const parsed = icsFeedUrlInputSchema.safeParse(input);
  if (!parsed.success) return null;

  let url: URL;
  try {
    url = new URL(parsed.data.replace(/^webcal:\/\//i, "https://"));
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(url.protocol)) return null;

  return url;
}
