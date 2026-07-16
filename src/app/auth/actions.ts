"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const requestOriginSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
});

export async function signInWithGoogle() {
  const supabase = await createClient();
  const parsedOrigin = requestOriginSchema.safeParse(
    (await headers()).get("origin"),
  );
  if (!parsedOrigin.success) {
    redirect("/?error=signin");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${parsedOrigin.data}/auth/callback` },
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
