import "server-only";

import { z } from "zod";
import { decryptGoogleSourceSecret, encryptSourceSecret } from "@/lib/source-secrets";
import { createAdminClient } from "@/lib/supabase/admin";

const tokenEnvironmentSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

const calendarResponseSchema = z.object({
  items: z.array(z.unknown()).default([]),
  nextPageToken: z.string().min(1).optional(),
});

const eventTimeSchema = z
  .object({
    dateTime: z.iso.datetime({ offset: true }).optional(),
    date: z.iso.date().optional(),
  })
  .refine((value) => value.dateTime !== undefined || value.date !== undefined);

const googleEventSchema = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  summary: z.string().optional(),
  location: z.string().optional(),
  start: eventTimeSchema,
  end: eventTimeSchema,
});

const sourceRowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  kind: z.literal("gcal"),
  url_secret: z.string().min(1),
});

const saveSourceInputSchema = z.object({
  userId: z.uuid(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).nullable(),
});

type CalendarEventWrite = {
  user_id: string;
  source_id: string;
  external_id: string;
  title: string;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
};

function allDayIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function toEventWrite(
  raw: unknown,
  userId: string,
  sourceId: string,
): CalendarEventWrite | null {
  const event = googleEventSchema.safeParse(raw);
  if (!event.success || event.data.status === "cancelled") return null;
  const allDay = event.data.start.date !== undefined;
  const startAt = event.data.start.dateTime ?? allDayIso(event.data.start.date!);
  const endAt = event.data.end.dateTime ?? allDayIso(event.data.end.date!);
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) return null;
  return {
    user_id: userId,
    source_id: sourceId,
    external_id: event.data.id,
    title: event.data.summary?.trim() || "Busy",
    location: event.data.location?.trim() || null,
    start_at: startAt,
    end_at: endAt,
    all_day: allDay,
  };
}

async function refreshAccessToken(refreshToken: string) {
  const environment = tokenEnvironmentSchema.safeParse({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });
  if (!environment.success) {
    throw new Error("Google OAuth server credentials are not configured.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: environment.data.clientId,
      client_secret: environment.data.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!response.ok || !parsed.success) {
    throw new Error("Google Calendar access could not be refreshed.");
  }
  return {
    accessToken: parsed.data.access_token,
    expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000).toISOString(),
  };
}

export async function saveGoogleCalendarSource(input: {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
}) {
  const parsedInput = saveSourceInputSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new Error("Google Calendar credentials are invalid.");
  }
  input = parsedInput.data;
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("sources")
    .select("id, url_secret")
    .eq("user_id", input.userId)
    .eq("kind", "gcal")
    .order("id")
    .limit(1)
    .maybeSingle();

  let refreshToken = input.refreshToken;
  if (!refreshToken && existing?.url_secret) {
    try {
      refreshToken = decryptGoogleSourceSecret(existing.url_secret).refreshToken;
    } catch {
      refreshToken = null;
    }
  }

  const urlSecret = encryptSourceSecret({
    accessToken: input.accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
  });

  if (existing) {
    const { error } = await admin
      .from("sources")
      .update({ url_secret: urlSecret, enabled: true, last_error: null })
      .eq("id", existing.id)
      .eq("user_id", input.userId);
    if (error) throw new Error("Google Calendar access could not be saved.");
    return existing.id;
  }

  const { data, error } = await admin
    .from("sources")
    .insert({
      user_id: input.userId,
      kind: "gcal",
      label: "Google Calendar",
      url_secret: urlSecret,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Google Calendar access could not be saved.");
  return data.id;
}

export async function syncGoogleCalendarSource(sourceId: string) {
  const parsedSourceId = z.uuid().safeParse(sourceId);
  if (!parsedSourceId.success) {
    return { ok: false as const, error: "Calendar source not found." };
  }
  const admin = createAdminClient();
  const { data: rawSource, error: sourceError } = await admin
    .from("sources")
    .select("id, user_id, kind, url_secret")
    .eq("id", parsedSourceId.data)
    .eq("enabled", true)
    .single();
  const source = sourceRowSchema.safeParse(rawSource);
  if (sourceError || !source.success) {
    return { ok: false as const, error: "Calendar source not found." };
  }

  try {
    let secret = decryptGoogleSourceSecret(source.data.url_secret);
    if (new Date(secret.expiresAt).getTime() <= Date.now() + 60_000) {
      if (!secret.refreshToken) {
        throw new Error("Reconnect Google Calendar to continue syncing.");
      }
      const refreshed = await refreshAccessToken(secret.refreshToken);
      secret = { ...secret, ...refreshed };
      await admin
        .from("sources")
        .update({ url_secret: encryptSourceSecret(secret) })
        .eq("id", source.data.id);
    }

    const writes: CalendarEventWrite[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      );
      url.searchParams.set(
        "timeMin",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      );
      url.searchParams.set(
        "timeMax",
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      );
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "2500");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const response = await fetch(url, {
        headers: { authorization: `Bearer ${secret.accessToken}` },
        cache: "no-store",
      });
      const page = calendarResponseSchema.safeParse(await response.json());
      if (!response.ok || !page.success) {
        throw new Error("Google Calendar returned an invalid response.");
      }
      for (const rawEvent of page.data.items) {
        const event = toEventWrite(
          rawEvent,
          source.data.user_id,
          source.data.id,
        );
        if (event) writes.push(event);
      }
      pageToken = page.data.nextPageToken;
    } while (pageToken);

    if (writes.length > 0) {
      const { error } = await admin
        .from("events")
        .upsert(writes, { onConflict: "source_id,external_id" });
      if (error) throw new Error("Calendar events could not be saved.");
    }

    const { data: existingEvents, error: existingError } = await admin
      .from("events")
      .select("id, external_id")
      .eq("source_id", source.data.id);
    if (existingError) throw new Error("Existing calendar events could not be read.");
    const seen = new Set(writes.map((event) => event.external_id));
    const removedIds = (existingEvents ?? [])
      .filter((event) => !seen.has(event.external_id))
      .map((event) => event.id);
    if (removedIds.length > 0) {
      const { error } = await admin.from("events").delete().in("id", removedIds);
      if (error) throw new Error("Removed calendar events could not be cleared.");
    }

    const syncedAt = new Date().toISOString();
    await admin
      .from("sources")
      .update({ last_synced_at: syncedAt, last_error: null })
      .eq("id", source.data.id);
    return { ok: true as const, count: writes.length, syncedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar sync failed.";
    await admin
      .from("sources")
      .update({ last_error: message })
      .eq("id", source.data.id);
    return { ok: false as const, error: message };
  }
}
