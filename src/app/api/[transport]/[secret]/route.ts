import { getMcpIdentity } from "@/lib/mcp-auth";
import { plannerMcpHandler } from "@/lib/mcp-server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteParameters = {
  params: Promise<{ transport: string; secret: string }>;
};

async function handleRequest(request: Request, context: RouteParameters) {
  const { transport, secret } = await context.params;
  if (transport !== "mcp") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if (!getMcpIdentity(secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const normalizedUrl = new URL(request.url);
  normalizedUrl.pathname = "/api/mcp";
  return plannerMcpHandler(new Request(normalizedUrl, request));
}

export { handleRequest as DELETE, handleRequest as GET, handleRequest as POST };
