import { createMcpHandler } from "mcp-handler";
import { getMcpIdentity } from "@/lib/mcp-auth";
import { registerPlannerTools } from "@/lib/mcp-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const mcpHandler = createMcpHandler(
  (server) => {
    const identity = getMcpIdentity(process.env.MCP_SECRET);
    if (!identity) throw new Error("MCP is not configured.");
    registerPlannerTools(server, identity.userId);
  },
  {
    serverInfo: { name: "personal-dashboard", version: "1.0.0" },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration,
  },
);

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
  return mcpHandler(new Request(normalizedUrl, request));
}

export { handleRequest as DELETE, handleRequest as GET, handleRequest as POST };
