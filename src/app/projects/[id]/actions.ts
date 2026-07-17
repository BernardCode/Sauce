"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const stepInputSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(500),
  estMinutes: z.number().int().positive().max(10_000),
  dueAtIso: z.iso.datetime({ offset: true }).nullable(),
});

const updateStepSchema = stepInputSchema.omit({ projectId: true }).extend({
  id: z.uuid(),
});

const idSchema = z.object({ id: z.uuid() });
const reorderSchema = z.object({
  projectId: z.uuid(),
  orderedStepIds: z.array(z.uuid()).max(100),
});

type ActionResult = { error: string | null };

function refreshProject(projectId?: string) {
  revalidatePath("/today");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function addProjectStep(input: unknown): Promise<ActionResult> {
  const parsed = stepInputSchema.safeParse(input);
  if (!parsed.success) return { error: "That step is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };

  const { data: project } = await supabase
    .from("items")
    .select("id, due_at")
    .eq("id", parsed.data.projectId)
    .eq("user_id", user.id)
    .eq("is_project", true)
    .eq("status", "open")
    .maybeSingle();
  if (!project) return { error: "That project could not be found." };
  if (
    project.due_at &&
    parsed.data.dueAtIso &&
    new Date(parsed.data.dueAtIso) > new Date(project.due_at)
  ) {
    return { error: "A step cannot be due after the project." };
  }
  const { data: lastStep } = await supabase
    .from("items")
    .select("step_order")
    .eq("parent_id", project.id)
    .eq("user_id", user.id)
    .order("step_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("items").insert({
    user_id: user.id,
    parent_id: project.id,
    title: parsed.data.title,
    est_minutes: parsed.data.estMinutes,
    remaining_minutes: parsed.data.estMinutes,
    due_at: parsed.data.dueAtIso,
    step_order: (lastStep?.step_order ?? -1) + 1,
    origin: "manual",
    status: "open",
  });
  if (error) return { error: "Could not add that step." };
  refreshProject(project.id);
  return { error: null };
}

export async function updateProjectStep(input: unknown): Promise<ActionResult> {
  const parsed = updateStepSchema.safeParse(input);
  if (!parsed.success) return { error: "That step is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data: step } = await supabase
    .from("items")
    .select("id, parent_id, actual_minutes")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .not("parent_id", "is", null)
    .maybeSingle();
  if (!step?.parent_id) return { error: "That step could not be found." };
  const { data: project } = await supabase
    .from("items")
    .select("due_at")
    .eq("id", step.parent_id)
    .eq("user_id", user.id)
    .eq("is_project", true)
    .maybeSingle();
  if (!project) return { error: "That project could not be found." };
  if (
    project.due_at &&
    parsed.data.dueAtIso &&
    new Date(parsed.data.dueAtIso) > new Date(project.due_at)
  ) {
    return { error: "A step cannot be due after the project." };
  }
  const { error } = await supabase
    .from("items")
    .update({
      title: parsed.data.title,
      est_minutes: parsed.data.estMinutes,
      remaining_minutes: Math.max(
        0,
        parsed.data.estMinutes - (step.actual_minutes ?? 0),
      ),
      due_at: parsed.data.dueAtIso,
      origin: "manual",
    })
    .eq("id", step.id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not update that step." };
  refreshProject(step.parent_id);
  return { error: null };
}

export async function deleteProjectStep(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "That step id is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { data: step } = await supabase
    .from("items")
    .select("id, parent_id")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .not("parent_id", "is", null)
    .maybeSingle();
  if (!step?.parent_id) return { error: "That step could not be found." };
  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", step.id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not delete that step." };
  refreshProject(step.parent_id);
  return { error: null };
}

export async function reorderProjectSteps(input: unknown): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: "That step order is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out. Refresh and sign in again." };
  const { error } = await supabase.rpc("reorder_project_steps", {
    project_id_arg: parsed.data.projectId,
    ordered_step_ids: parsed.data.orderedStepIds,
  });
  if (error) return { error: "Could not reorder those steps." };
  refreshProject(parsed.data.projectId);
  return { error: null };
}

export async function createStarterBreakdown(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ projectId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { error: "That project id is not valid." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You are signed out." };
  const { data: project } = await supabase.from("items").select("id, title, due_at, est_minutes").eq("id", parsed.data.projectId).eq("user_id", user.id).eq("is_project", true).eq("status", "open").maybeSingle();
  if (!project) return { error: "That project could not be found." };
  const { count } = await supabase.from("items").select("id", { count: "exact", head: true }).eq("parent_id", project.id).eq("user_id", user.id);
  if ((count ?? 0) > 0) return { error: "This project already has steps. Edit them or ask the planner to re-break it down." };
  const total = Math.max(45, project.est_minutes ?? 180);
  const estimates = [Math.max(15, Math.round(total * 0.2)), Math.max(15, Math.round(total * 0.6)), Math.max(15, Math.round(total * 0.2))];
  const now = Date.now();
  const deadline = project.due_at ? new Date(project.due_at).getTime() : now + 7 * 86_400_000;
  const dueAt = (fraction: number) => project.due_at && deadline <= now
    ? project.due_at
    : new Date(now + Math.max(0, deadline - now) * fraction).toISOString();
  const { error } = await supabase.from("items").insert([
    { user_id: user.id, parent_id: project.id, title: `Plan ${project.title}`, est_minutes: estimates[0], remaining_minutes: estimates[0], due_at: dueAt(0.3), step_order: 0, origin: "ai", status: "open", energy: "medium" },
    { user_id: user.id, parent_id: project.id, title: `Complete ${project.title}`, est_minutes: estimates[1], remaining_minutes: estimates[1], due_at: dueAt(0.75), step_order: 1, origin: "ai", status: "open", energy: "high" },
    { user_id: user.id, parent_id: project.id, title: "Review and submit", est_minutes: estimates[2], remaining_minutes: estimates[2], due_at: project.due_at ?? dueAt(1), step_order: 2, origin: "ai", status: "open", energy: "medium" },
  ]);
  if (error) return { error: "Could not create starter steps." };
  refreshProject(project.id);
  return { error: null };
}
