import "server-only";

import { createMcpHandler } from "mcp-handler";
import { getConfiguredMcpUserId } from "@/lib/mcp-auth";
import { registerPlannerTools } from "@/lib/mcp-tools";

export const plannerMcpHandler = createMcpHandler(
  (server) => {
    const userId = getConfiguredMcpUserId();
    if (!userId) throw new Error("MCP is not configured.");
    registerPlannerTools(server, userId);
  },
  {
    serverInfo: { name: "personal-dashboard", version: "1.0.0" },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
  },
);
