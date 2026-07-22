"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const decisionSchema = z.object({
  authorizationId: z.string().trim().min(1).max(1_024),
  decision: z.enum(["approve", "deny"]),
});

const environmentSchema = z.object({
  userId: z.uuid(),
});

const redirectUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
});

function consentPath(authorizationId?: string, error?: string) {
  const query = new URLSearchParams();
  if (authorizationId) query.set("authorization_id", authorizationId);
  if (error) query.set("error", error);
  return `/oauth/consent?${query.toString()}`;
}

export async function decideOAuthAuthorization(formData: FormData) {
  const input = decisionSchema.safeParse({
    authorizationId: formData.get("authorization_id"),
    decision: formData.get("decision"),
  });
  if (!input.success) redirect(consentPath(undefined, "invalid"));

  const environment = environmentSchema.safeParse({
    userId: process.env.MCP_USER_ID,
  });
  if (!environment.success) {
    redirect(consentPath(input.data.authorizationId, "configuration"));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== environment.data.userId) {
    redirect(consentPath(input.data.authorizationId, "unauthorized"));
  }

  const result =
    input.data.decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(
          input.data.authorizationId,
          { skipBrowserRedirect: true },
        )
      : await supabase.auth.oauth.denyAuthorization(
          input.data.authorizationId,
          { skipBrowserRedirect: true },
        );

  const redirectUrl = redirectUrlSchema.safeParse(result.data?.redirect_url);
  if (result.error || !redirectUrl.success) {
    redirect(consentPath(input.data.authorizationId, "decision"));
  }
  redirect(redirectUrl.data);
}
