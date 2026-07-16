import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const callbackQuerySchema = z.object({
  code: z.string().trim().min(1).max(4096),
});

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const parsedQuery = callbackQuerySchema.safeParse({
    code: searchParams.get("code"),
  });

  if (parsedQuery.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(
      parsedQuery.data.code,
    );
    if (!error) {
      return NextResponse.redirect(`${origin}/today`);
    }
  }
  return NextResponse.redirect(`${origin}/?error=signin`);
}
