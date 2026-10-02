import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  applyPlan: vi.fn(async () => ({ written: 1, rejected: [] })),
  archivePlannerItem: vi.fn(async () => ({ archived: true })),
  completePlannerItem: vi.fn(async () => ({ completed: true })),
  createPlannerNote: vi.fn(),
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
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("MCP planner tool registration", () => {
  it.each(["add_item", "decompose_project"])("rejects removed task creation tool %s", async (name) => {
    const client = await connectPlanner();
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).not.toContain(name);
    const result = await client.callTool({
      name,
      arguments: {
        title: "Do not create this task",
        project_id: itemId,
        steps: [{ title: "Do not create this step", est_minutes: 30, step_order: 0, suggested_due: "2026-09-30T23:00:00.000Z" }],
      },
    });
    expect(result.isError).toBe(true);
  });

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
          confirmed_by_user: { const: true },
        },
        required: ["item_id", "confirmed_by_user"],
      });
      expect(tool?.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }

    const input = { item_id: itemId, confirmed_by_user: true };
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

  it("exposes the existing task editing fields", async () => {
    const client = await connectPlanner();
    const listed = await client.listTools();
    const updateTool = listed.tools.find((tool) => tool.name === "update_item");

    expect(updateTool?.inputSchema).toMatchObject({
      properties: {
        item_id: { type: "string", format: "uuid" },
        confirmed_by_user: { const: true },
        title: { type: "string" },
        category: { anyOf: expect.any(Array) },
        planned_date: { anyOf: expect.any(Array) },
      },
      required: ["item_id", "confirmed_by_user"],
    });
  });
});
