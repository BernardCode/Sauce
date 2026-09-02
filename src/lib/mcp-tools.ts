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
        "Load future open work, calendar events, every scheduled block, the protected manual or locked block subset, habits, settings, class meeting days, school dismissal windows, postponed-work status, and planner runs for a date horizon. Dated active leaf items include scheduling_guidance with a completion target, latest necessary start date, and session budget.",
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
        "Validate and replace unlocked AI blocks in a planning horizon. Blocks before school dismissal or for postponed work are rejected individually.",
      inputSchema: applyPlanInputSchema.shape,
    },
    async (input) => asTextResult(await applyPlan(userId, input)),
  );

  server.registerTool(
    "add_item",
    {
      title: "Add item",
      description:
        "Add one task or long-term project. Use is_project for multi-session outcomes, category for a class or workstream, planned_date only for a small task intentionally assigned to that day's Today list, and list set to later for a low-pressure reminder or task that should stay out of Main until it is timely.",
      inputSchema: addItemInputSchema.shape,
    },
    async (input) => asTextResult(await addPlannerItem(userId, input)),
  );

  server.registerTool(
    "update_item",
    {
      title: "Update item",
      description:
        "Edit an open task or project only after the user explicitly requests the exact change in the current conversation. Set confirmed_by_user to true only for that direct request. Never use this tool during an unattended planner run. Feed items remain read-only, and projects never receive a planned_date.",
      inputSchema: updateItemInputSchema.shape,
    },
    async (input) => asTextResult(await updatePlannerItem(userId, input)),
  );

  server.registerTool(
    "complete_item",
    {
      title: "Complete item",
      description:
        "Mark an open task or project step complete only after the user explicitly confirms completion in the current conversation. Set confirmed_by_user to true only for that direct confirmation. Never use this tool during an unattended planner run.",
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
        "Soft-archive an open non-feed item only after the user explicitly asks to remove that exact item in the current conversation. Set confirmed_by_user to true only for that direct request. Never use this tool during an unattended planner run.",
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
