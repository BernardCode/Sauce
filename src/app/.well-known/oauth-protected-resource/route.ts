import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { getSupabaseOAuthIssuer } from "@/lib/mcp-auth";

export const runtime = "nodejs";

export function GET(request: Request) {
  const issuer = getSupabaseOAuthIssuer();
  if (!issuer) {
    return Response.json(
      { error: "OAuth is not configured." },
      { status: 503 },
    );
  }
  return protectedResourceHandler({ authServerUrls: [issuer] })(request);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
