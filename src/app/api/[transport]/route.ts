import { withMcpAuth } from "mcp-handler";
import { verifyMcpAccessToken } from "@/lib/mcp-auth";
import { plannerMcpHandler } from "@/lib/mcp-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const authenticatedMcpHandler = withMcpAuth(
  plannerMcpHandler,
  verifyMcpAccessToken,
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  },
);

type RouteParameters = {
  params: Promise<{ transport: string }>;
};

async function handleRequest(request: Request, context: RouteParameters) {
  const { transport } = await context.params;
  if (transport !== "mcp") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  return authenticatedMcpHandler(request);
}

export { handleRequest as DELETE, handleRequest as GET, handleRequest as POST };
