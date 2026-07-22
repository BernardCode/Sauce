"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseSafeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

const requestOriginSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
});

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const parsedOrigin = requestOriginSchema.safeParse(
    (await headers()).get("origin"),
  );
  if (!parsedOrigin.success) {
    redirect("/?error=signin");
  }

  const nextPath = parseSafeNextPath(formData.get("next"));
  const callbackUrl = new URL("/auth/callback", parsedOrigin.data);
  if (nextPath) callbackUrl.searchParams.set("next", nextPath);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: "https://www.googleapis.com/auth/calendar.readonly",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    redirect("/?error=signin");
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
