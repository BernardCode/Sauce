import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addPlannerItem,
  applyPlan,
  archivePlannerItem,
  completePlannerItem,
  createPlannerNote,
  decomposeProject,
  getPlanningContext,
  logPlannerHabit,
  updatePlannerItem,
  updatePlannerNote,
} from "@/lib/planner/service";
import {
  addItemInputSchema,
  applyPlanInputSchema,
  createNoteInputSchema,
  dateRangeSchema,
  decomposeProjectInputSchema,
  itemLifecycleInputSchema,
  logHabitInputSchema,
  updateItemInputSchema,
  updateNoteInputSchema,
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
      description:
        "Add one task or project with optional supporting details and a source link.",
      inputSchema: addItemInputSchema.shape,
    },
    async (input) => asTextResult(await addPlannerItem(userId, input)),
  );

  server.registerTool(
    "update_item",
    {
      title: "Update item",
      description:
        "Update an open task or project owned by the user. Feed items remain read-only.",
      inputSchema: updateItemInputSchema.shape,
    },
    async (input) => asTextResult(await updatePlannerItem(userId, input)),
  );

  server.registerTool(
    "complete_item",
    {
      title: "Complete item",
      description:
        "Mark an open task or project step complete. Projects complete automatically after their open steps are complete.",
      inputSchema: itemLifecycleInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => asTextResult(await completePlannerItem(userId, input)),
  );

  server.registerTool(
    "archive_item",
    {
      title: "Archive item",
      description:
        "Soft-archive an open non-feed item. Open project steps are archived with their project, while completed steps and manual or locked blocks are preserved.",
      inputSchema: itemLifecycleInputSchema.shape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => asTextResult(await archivePlannerItem(userId, input)),
  );

  server.registerTool(
    "create_note",
    {
      title: "Create note",
      description: "Create a note with a title, Markdown body, and optional pinned state.",
      inputSchema: createNoteInputSchema.shape,
    },
    async (input) => asTextResult(await createPlannerNote(userId, input)),
  );

  server.registerTool(
    "update_note",
    {
      title: "Update note",
      description: "Update a note by its Sauce note id.",
      inputSchema: updateNoteInputSchema.shape,
    },
    async (input) => asTextResult(await updatePlannerNote(userId, input)),
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
