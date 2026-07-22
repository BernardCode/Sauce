import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import { secretsMatch } from "./mcp-auth-core";

const environmentSchema = z.object({
  secret: z.string().min(32),
  userId: z.uuid(),
});

const oauthEnvironmentSchema = z.object({
  supabaseUrl: z.url(),
  publishableKey: z.string().min(1),
  userId: z.uuid(),
});

const bearerTokenSchema = z.string().min(20).max(16_384);

const accessTokenClaimsSchema = z.object({
  sub: z.uuid(),
  exp: z.number().int().positive(),
  client_id: z.string().trim().min(1).max(512).optional(),
  scope: z.string().trim().max(2_048).optional(),
  scopes: z.array(z.string().trim().min(1).max(256)).max(100).optional(),
});

export function getConfiguredMcpUserId() {
  const environment = z
    .object({ userId: z.uuid() })
    .safeParse({ userId: process.env.MCP_USER_ID });
  return environment.success ? environment.data.userId : null;
}

export function getMcpIdentity(candidateSecret: unknown) {
  const environment = environmentSchema.safeParse({
    secret: process.env.MCP_SECRET,
    userId: process.env.MCP_USER_ID,
  });
  const candidate = z.string().min(32).safeParse(candidateSecret);
  if (
    !environment.success ||
    !candidate.success ||
    !secretsMatch(candidate.data, environment.data.secret)
  ) {
    return null;
  }
  return { userId: environment.data.userId };
}

export function getSupabaseOAuthIssuer() {
  const parsedUrl = z.url().safeParse(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!parsedUrl.success) return null;
  return new URL("/auth/v1", parsedUrl.data).toString();
}

export async function verifyMcpAccessToken(
  _request: Request,
  candidateToken?: string,
): Promise<AuthInfo | undefined> {
  const environment = oauthEnvironmentSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    userId: process.env.MCP_USER_ID,
  });
  const token = bearerTokenSchema.safeParse(candidateToken);
  if (!environment.success || !token.success) return undefined;

  const supabase = createClient(
    environment.data.supabaseUrl,
    environment.data.publishableKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
  const { data, error } = await supabase.auth.getClaims(token.data);
  const claims = accessTokenClaimsSchema.safeParse(data?.claims);
  if (
    error ||
    !claims.success ||
    claims.data.sub !== environment.data.userId
  ) {
    return undefined;
  }

  const scopes = claims.data.scopes ?? claims.data.scope?.split(/\s+/) ?? [];
  return {
    token: token.data,
    clientId: claims.data.client_id ?? "supabase-oauth-client",
    scopes,
    expiresAt: claims.data.exp,
    extra: { userId: claims.data.sub },
  };
}
