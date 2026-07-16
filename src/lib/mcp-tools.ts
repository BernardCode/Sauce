import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addPlannerItem,
  applyPlan,
  decomposeProject,
  getPlanningContext,
  logPlannerHabit,
} from "@/lib/planner/service";
import {
  addItemInputSchema,
  applyPlanInputSchema,
  dateRangeSchema,
  decomposeProjectInputSchema,
  logHabitInputSchema,
} from "@/lib/planner/schemas";
import { defaultPlanningRange } from "@/lib/mcp-tools-core";

const optionalDateRangeSchema = z.object({
  from_date: z.iso.date().optional(),
  to_date: z.iso.date().optional(),
});

function asTextResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

export function registerPlannerTools(server: McpServer, userId: string) {
  server.registerTool(
    "get_planning_context",
    {
      title: "Get planning context",
      description:
        "Load open work, calendar events, habits, protected blocks, settings, and planner runs for a date horizon.",
      inputSchema: optionalDateRangeSchema.shape,
    },
    async (input) => {
      const defaults = defaultPlanningRange();
      const range = dateRangeSchema.safeParse({
        from_date: input.from_date ?? defaults.from_date,
        to_date: input.to_date ?? defaults.to_date,
      });
      if (!range.success) {
        return asTextResult({ error: "The planning range is not valid." });
      }
      return asTextResult(await getPlanningContext(userId, range.data));
    },
  );

  server.registerTool(
    "decompose_project",
    {
      title: "Decompose project",
      description:
        "Replace untouched AI steps for one project while preserving manual or worked steps.",
      inputSchema: decomposeProjectInputSchema.shape,
    },
    async (input) => asTextResult(await decomposeProject(userId, input)),
  );

  server.registerTool(
    "apply_plan",
    {
      title: "Apply plan",
      description:
        "Validate and replace unlocked AI blocks in a planning horizon. Invalid blocks are rejected individually.",
      inputSchema: applyPlanInputSchema.shape,
    },
    async (input) => asTextResult(await applyPlan(userId, input)),
  );

  server.registerTool(
    "add_item",
    {
      title: "Add item",
      description: "Add one task or project to the dashboard.",
      inputSchema: addItemInputSchema.shape,
    },
    async (input) => asTextResult(await addPlannerItem(userId, input)),
  );

  server.registerTool(
    "log_habit",
    {
      title: "Log habit",
      description: "Mark one habit complete for a date.",
      inputSchema: logHabitInputSchema.shape,
    },
    async (input) => asTextResult(await logPlannerHabit(userId, input)),
  );
}
