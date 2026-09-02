import "server-only";

import ical from "node-ical";
import { z } from "zod";
import { validatePublicLinkUrl } from "@/lib/links/metadata";
import {
  decryptSourceSecret,
  encryptSourceSecret,
  icsSourceSecretSchema,
} from "@/lib/source-secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { endOfLocalDay, safeTimeZone } from "@/lib/planner/time";
import { toIcsItemCandidate } from "./ics-schema";
import { normalizeIcsFeedUrl } from "./ics-url";

const sourceSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  kind: z.literal("ics"),
  label: z.string().min(1),
  url_secret: z.string().min(1),
});

const profileSchema = z.object({
  timezone: z.string().trim().min(1).max(100),
});

const saveSchema = z.object({
  userId: z.uuid(),
  label: z.string().trim().min(1).max(100),
  url: z.string().trim().min(1).max(4_000),
});
const icsDocumentSchema = z
  .string()
  .min(1)
  .max(5_000_000)
  .refine(
    (value) => value.includes("BEGIN:VCALENDAR") && value.includes("END:VCALENDAR"),
    "The feed did not return an ICS calendar.",
  );

async function readLimitedBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 5_000_000) {
      await reader.cancel();
      throw new Error("The ICS feed is too large.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

async function fetchIcs(initialUrl: URL): Promise<string> {
  let url = new URL(initialUrl);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await validatePublicLinkUrl(url);
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "PersonalDashboardIcsSync/1.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The ICS redirect has no destination.");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error("The ICS feed could not be loaded.");
    return readLimitedBody(response);
  }
  throw new Error("The ICS feed redirected too many times.");
}

export async function saveIcsSource(input: unknown) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "That ICS source is not valid." };
  const url = normalizeIcsFeedUrl(parsed.data.url);
  if (!url) return { ok: false as const, error: "That ICS source is not valid." };
  try {
    await validatePublicLinkUrl(url);
  } catch {
    return { ok: false as const, error: "Only public HTTPS or HTTP feeds are supported." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sources")
    .insert({
      user_id: parsed.data.userId,
      kind: "ics",
      label: parsed.data.label,
      url_secret: encryptSourceSecret({ url: url.toString() }),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: "Could not save that ICS source." };
  return { ok: true as const, id: data.id };
}

export async function syncIcsSource(sourceId: string) {
  const parsedId = z.uuid().safeParse(sourceId);
  if (!parsedId.success) return { ok: false as const, error: "ICS source not found." };
  const admin = createAdminClient();
  const { data: rawSource } = await admin
    .from("sources")
    .select("id, user_id, kind, label, url_secret")
    .eq("id", parsedId.data)
    .eq("enabled", true)
    .maybeSingle();
  const source = sourceSchema.safeParse(rawSource);
  if (!source.success) return { ok: false as const, error: "ICS source not found." };
  const runStartedAt = new Date().toISOString();

  try {
    const secret = icsSourceSecretSchema.parse(
      decryptSourceSecret(source.data.url_secret),
    );
    const feedUrl = new URL(secret.url);
    const inferSchoologyCourse =
      source.data.label.trim().toLowerCase() === "schoology" ||
      feedUrl.hostname.toLowerCase() === "schoology.com" ||
      feedUrl.hostname.toLowerCase().endsWith(".schoology.com");
    const { data: rawProfile, error: profileError } = await admin
      .from("users")
      .select("timezone")
      .eq("id", source.data.user_id)
      .single();
    const profile = profileSchema.safeParse(rawProfile);
    if (profileError || !profile.success) {
      throw new Error("The calendar time zone could not be loaded.");
    }
    const timeZone = safeTimeZone(profile.data.timezone);
    const document = icsDocumentSchema.parse(await fetchIcs(feedUrl));
    const parsedCalendar = await ical.async.parseICS(document);
    const candidates = Object.values(parsedCalendar)
      .map((component) =>
        toIcsItemCandidate(component, { inferSchoologyCourse }),
      )
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
    const uniqueCandidates = [
      ...new Map(candidates.map((candidate) => [candidate.externalId, candidate])).values(),
    ];
    const { data: existing, error: existingError } = await admin
      .from("items")
      .select("external_id, status")
      .eq("source_id", source.data.id);
    if (existingError) throw new Error("Existing feed items could not be read.");
    const existingStatuses = new Map(
      (existing ?? []).flatMap((item) =>
        item.external_id ? [[item.external_id, item.status] as const] : [],
      ),
    );
    const { data: courseDefaults, error: courseDefaultsError } = await admin
      .from("course_defaults")
      .select("course, default_minutes")
      .eq("user_id", source.data.user_id);
    if (courseDefaultsError) {
      throw new Error("Course defaults could not be read.");
    }
    const defaultMinutesByCourse = new Map(
      (courseDefaults ?? []).map((entry) => [
        entry.course,
        entry.default_minutes,
      ]),
    );
    const writes = uniqueCandidates.map((candidate) => {
      const course = candidate.course ?? source.data.label;
      const defaultMinutes = defaultMinutesByCourse.get(course);
      return {
        user_id: source.data.user_id,
        source_id: source.data.id,
        external_id: candidate.externalId,
        title: candidate.title,
        description: candidate.description,
        course,
        due_at: candidate.dueDate
          ? endOfLocalDay(candidate.dueDate, timeZone)
          : candidate.dueAt,
        priority: candidate.priority,
        status: existingStatuses.get(candidate.externalId) === "done" ? "done" : "open",
        origin: "feed",
        last_seen_at: runStartedAt,
        ...(!existingStatuses.has(candidate.externalId) && defaultMinutes
          ? {
              est_minutes: defaultMinutes,
              remaining_minutes: defaultMinutes,
            }
          : {}),
      };
    });
    if (writes.length) {
      const { error } = await admin.from("items").upsert(writes, {
        onConflict: "source_id,external_id",
      });
      if (error) throw new Error("ICS assignments could not be saved.");
    }
    const { error: archiveError } = await admin
      .from("items")
      .update({ status: "archived" })
      .eq("source_id", source.data.id)
      .eq("status", "open")
      .or(`last_seen_at.is.null,last_seen_at.lt.${runStartedAt}`);
    if (archiveError) throw new Error("Removed ICS assignments could not be archived.");
    await admin
      .from("sources")
      .update({ last_synced_at: runStartedAt, last_error: null })
      .eq("id", source.data.id);
    return { ok: true as const, count: writes.length, syncedAt: runStartedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ICS sync failed.";
    await admin.from("sources").update({ last_error: message }).eq("id", source.data.id);
    return { ok: false as const, error: message };
  }
}
