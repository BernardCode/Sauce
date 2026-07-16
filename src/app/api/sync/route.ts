import { z } from "zod";
import { syncGoogleCalendarSource } from "@/lib/calendar/google";
import { createAdminClient } from "@/lib/supabase/admin";

const cronEnvironmentSchema = z.object({
  secret: z.string().min(32),
});

export async function GET(request: Request) {
  const environment = cronEnvironmentSchema.safeParse({
    secret: process.env.CRON_SECRET,
  });
  const authorization = z.string().safeParse(
    request.headers.get("authorization"),
  );
  if (
    !environment.success ||
    !authorization.success ||
    authorization.data !== `Bearer ${environment.data.secret}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: sources, error } = await admin
    .from("sources")
    .select("id, kind")
    .eq("enabled", true);
  if (error) {
    return Response.json({ error: "Could not load sources." }, { status: 500 });
  }

  let synced = 0;
  let failed = 0;
  for (const source of sources ?? []) {
    if (source.kind !== "gcal") continue;
    const result = await syncGoogleCalendarSource(source.id);
    if (result.ok) synced += 1;
    else failed += 1;
  }

  return Response.json({ synced, failed });
}
