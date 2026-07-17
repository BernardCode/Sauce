import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { StepList, type ProjectStep } from "./step-list";
import { RebreakdownRequest } from "./rebreakdown-request";

function percent(value: number, total: number): number {
  return total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100));
}

function requestTimeMs(): number {
  return Date.now();
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsedId = z.uuid().safeParse((await params).id);
  if (!parsedId.success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [projectResult, stepsResult] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, due_at, est_minutes, actual_minutes, status")
      .eq("id", parsedId.data)
      .eq("user_id", user.id)
      .eq("is_project", true)
      .maybeSingle(),
    supabase
      .from("items")
      .select("id, title, est_minutes, remaining_minutes, actual_minutes, due_at, status, origin, step_order")
      .eq("parent_id", parsedId.data)
      .eq("user_id", user.id)
      .order("step_order", { ascending: true }),
  ]);
  const project = projectResult.data;
  if (!project) notFound();
  const rows = stepsResult.data ?? [];
  const stepIds = rows.map((step) => step.id);
  const { data: blocks } = stepIds.length
    ? await supabase
        .from("blocks")
        .select("item_id, start_at, end_at")
        .eq("user_id", user.id)
        .in("item_id", stepIds)
        .eq("done", false)
        .order("start_at", { ascending: true })
    : { data: [] };
  const firstBlock = new Map<string, { start_at: string; end_at: string }>();
  for (const block of blocks ?? []) {
    if (block.item_id && !firstBlock.has(block.item_id)) {
      firstBlock.set(block.item_id, block);
    }
  }
  const steps: ProjectStep[] = rows.map((step) => ({
    id: step.id,
    title: step.title,
    estMinutes: step.est_minutes,
    dueAt: step.due_at,
    status: step.status,
    origin: step.origin,
    blockStart: firstBlock.get(step.id)?.start_at ?? null,
  }));

  const doneSteps = rows.filter((step) => step.status === "done").length;
  const estimated = rows.reduce((sum, step) => sum + (step.est_minutes ?? 0), 0);
  const actual = rows.reduce((sum, step) => sum + (step.actual_minutes ?? 0), 0);
  const progress = Math.max(
    percent(actual, estimated),
    percent(doneSteps, rows.length),
  );
  const deadline = project.due_at ? new Date(project.due_at) : null;
  const atRisk = Boolean(
    deadline &&
      rows.some((step) => {
        if (step.status === "done") return false;
        const block = firstBlock.get(step.id);
        return block && new Date(block.end_at) > deadline;
      }),
  );
  const timelineStart = requestTimeMs();
  const timelineEnd = Math.max(
    timelineStart + 24 * 60 * 60 * 1000,
    deadline?.getTime() ?? timelineStart + 7 * 24 * 60 * 60 * 1000,
  );

  return (
    <div className="app-page" data-page="project">
      <AppHeader />
      <main className="flex flex-col gap-6">
        {atRisk ? (
          <div className="motion-at-risk rounded-xl border border-red-200 bg-[var(--danger-soft)] p-4 text-sm font-medium text-red-700 dark:border-red-900 dark:text-red-200">
            At risk. At least one scheduled step ends after the project deadline.
          </div>
        ) : null}
        <section className="motion-project-hero project-summary">
          <p className="page-kicker">Project overview</p>
          <h1>{project.title}</h1>
          <p className="project-summary-deadline">
            {deadline ? `Due ${deadline.toLocaleString()}` : "No deadline"}
          </p>
          <div className="project-progress-track">
            <div className="motion-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="project-summary-meta">
            {doneSteps} of {rows.length} steps done, {actual} of {estimated} estimated minutes logged
          </p>
        </section>

        <section className="workspace-card motion-project-section">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Steps</h2>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-zinc-500">Drag to reorder.</p>
              <RebreakdownRequest projectId={project.id} canCreateStarter={rows.length === 0} />
            </div>
          </div>
          <StepList
            key={rows
              .map((step) =>
                [
                  step.id,
                  step.title,
                  step.status,
                  step.origin,
                  step.step_order,
                  step.est_minutes,
                  step.due_at,
                ].join(":"),
              )
              .join("|")}
            projectId={project.id}
            steps={steps}
          />
        </section>

        <section className="workspace-card motion-project-section">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <div className="mt-3 flex flex-col gap-2">
            {rows.map((step) => {
              const block = firstBlock.get(step.id);
              const start = block ? new Date(block.start_at).getTime() : null;
              const end = block ? new Date(block.end_at).getTime() : null;
              const left = start === null
                ? 0
                : percent(Math.max(0, start - timelineStart), timelineEnd - timelineStart);
              const width = start === null || end === null
                ? 0
                : Math.max(2, percent(end - start, timelineEnd - timelineStart));
              return (
                <div key={step.id} className="grid grid-cols-[12rem_1fr] items-center gap-3">
                  <span className="truncate text-sm">{step.title}</span>
                  {block ? (
                    <div className="relative h-5 rounded-full bg-[var(--surface-subtle)]">
                      <div
                        className="motion-timeline-bar absolute h-5 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                        style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                      />
                    </div>
                  ) : (
                    <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-900">
                      Not yet placed
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
