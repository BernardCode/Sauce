import { NextResponse } from "next/server";
import { z } from "zod";
import { saveGoogleCalendarSource } from "@/lib/calendar/google";
import { parseSafeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

const callbackQuerySchema = z.object({
  code: z.string().trim().min(1).max(4096),
  next: z.string().max(2_048).nullable(),
});

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const parsedQuery = callbackQuerySchema.safeParse({
    code: searchParams.get("code"),
    next: searchParams.get("next"),
  });

  if (parsedQuery.success) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      parsedQuery.data.code,
    );
    if (!error && data.session?.provider_token && data.user) {
      try {
        await saveGoogleCalendarSource({
          userId: data.user.id,
          accessToken: data.session.provider_token,
          refreshToken: data.session.provider_refresh_token ?? null,
        });
      } catch {
        return NextResponse.redirect(`${origin}/?error=calendar`);
      }
      const nextPath = parseSafeNextPath(parsedQuery.data.next) ?? "/today";
      return NextResponse.redirect(new URL(nextPath, origin));
    }
  }
  return NextResponse.redirect(`${origin}/?error=signin`);
}
