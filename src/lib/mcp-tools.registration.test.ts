import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  addPlannerItem: vi.fn(),
  applyPlan: vi.fn(async () => ({ written: 1, rejected: [] })),
  archivePlannerItem: vi.fn(async () => ({ archived: true })),
  completePlannerItem: vi.fn(async () => ({ completed: true })),
  createPlannerNote: vi.fn(),
  decomposeProject: vi.fn(async () => ({ written: 1, rejected: [] })),
  getPlanningContext: vi.fn(),
  logPlannerHabit: vi.fn(),
  updatePlannerItem: vi.fn(),
  updatePlannerNote: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/planner/service", () => serviceMocks);
vi.mock("@/lib/planner/schemas", async () => import("./planner/schemas"));
vi.mock("@/lib/mcp-tools-core", async () => import("./mcp-tools-core"));

import { registerPlannerTools } from "./mcp-tools";

const userId = "00000000-0000-4000-8000-000000000001";
const itemId = "00000000-0000-4000-8000-000000000002";
const clients: Client[] = [];
const servers: McpServer[] = [];

async function connectPlanner() {
  const server = new McpServer({ name: "sauce-test", version: "1.0.0" });
  registerPlannerTools(server, userId);
  const client = new Client({ name: "sauce-test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  clients.push(client);
  servers.push(server);
  return client;
}

afterEach(async () => {
  serviceMocks.applyPlan.mockClear();
  serviceMocks.archivePlannerItem.mockClear();
  serviceMocks.completePlannerItem.mockClear();
  serviceMocks.decomposeProject.mockClear();
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("MCP planner tool registration", () => {
  it("advertises every nested apply_plan block field", async () => {
    const client = await connectPlanner();
    const listed = await client.listTools();
    const tool = listed.tools.find((candidate) => candidate.name === "apply_plan");

    expect(tool?.inputSchema).toMatchObject({
      properties: {
        blocks: {
          items: {
            type: "object",
            properties: {
              item_id: { type: "string", format: "uuid" },
              title: { type: "string" },
              start_at: { type: "string" },
              end_at: { type: "string" },
              reason: { type: "string" },
            },
            required: ["item_id", "title", "start_at", "end_at", "reason"],
          },
        },
      },
    });

    const input = {
      from_date: "2026-07-22",
      to_date: "2026-07-29",
      blocks: [
        {
          item_id: itemId,
          title: "Review midterm material",
          start_at: "2026-07-22T16:00:00.000Z",
          end_at: "2026-07-22T17:00:00.000Z",
          reason: "The midterm opens tomorrow morning.",
        },
      ],
      scheduled_pass: true,
    };
    const result = await client.callTool({
      name: "apply_plan",
      arguments: input,
    });

    expect(result.isError).not.toBe(true);
    expect(serviceMocks.applyPlan).toHaveBeenCalledWith(userId, input);
  });

  it("advertises every nested decompose_project step field", async () => {
    const client = await connectPlanner();
    const listed = await client.listTools();
    const tool = listed.tools.find(
      (candidate) => candidate.name === "decompose_project",
    );

    expect(tool?.inputSchema).toMatchObject({
      properties: {
        steps: {
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              est_minutes: { type: "integer" },
              step_order: { type: "integer" },
              suggested_due: { type: "string" },
            },
            required: [
              "title",
              "est_minutes",
              "step_order",
              "suggested_due",
            ],
          },
        },
      },
    });

    const input = {
      project_id: itemId,
      steps: [
        {
          title: "Review chapter notes",
          est_minutes: 45,
          step_order: 0,
          suggested_due: "2026-07-22T23:00:00.000Z",
        },
      ],
    };
    const result = await client.callTool({
      name: "decompose_project",
      arguments: input,
    });

    expect(result.isError).not.toBe(true);
    expect(serviceMocks.decomposeProject).toHaveBeenCalledWith(userId, input);
  });

  it("exposes item completion and soft archiving", async () => {
    const client = await connectPlanner();
    const listed = await client.listTools();
    const completeTool = listed.tools.find(
      (candidate) => candidate.name === "complete_item",
    );
    const archiveTool = listed.tools.find(
      (candidate) => candidate.name === "archive_item",
    );

    for (const tool of [completeTool, archiveTool]) {
      expect(tool?.inputSchema).toMatchObject({
        properties: {
          item_id: { type: "string", format: "uuid" },
        },
        required: ["item_id"],
      });
      expect(tool?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }

    const input = { item_id: itemId };
    const completeResult = await client.callTool({
      name: "complete_item",
      arguments: input,
    });
    const archiveResult = await client.callTool({
      name: "archive_item",
      arguments: input,
    });

    expect(completeResult.isError).not.toBe(true);
    expect(archiveResult.isError).not.toBe(true);
    expect(serviceMocks.completePlannerItem).toHaveBeenCalledWith(userId, input);
    expect(serviceMocks.archivePlannerItem).toHaveBeenCalledWith(userId, input);
  });
});
