import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";

type ProjectRow = {
  id: string;
  title: string;
  course: string | null;
  due_at: string | null;
  est_minutes: number | null;
  actual_minutes: number | null;
};

function progressPercent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data, error } = await supabase
    .from("items")
    .select("id, title, course, due_at, est_minutes, actual_minutes")
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("is_project", true)
    .is("parent_id", null)
    .order("due_at", { ascending: true, nullsFirst: false });
  const projects = (data ?? []) as ProjectRow[];
  const projectIds = projects.map((project) => project.id);
  const stepsResult = projectIds.length
    ? await supabase
        .from("items")
        .select("parent_id, status, est_minutes, actual_minutes")
        .eq("user_id", user.id)
        .in("parent_id", projectIds)
    : { data: [], error: null };

  return (
    <div className="app-page" data-page="projects">
      <AppHeader />
      <main>
        <div className="page-intro">
          <div>
            <p className="page-kicker">Long-term work</p>
            <h1 className="page-title">Projects</h1>
            <p className="page-description">
              Projects stay here. Their scheduled steps appear on Today when it is time to act.
            </p>
          </div>
        </div>

        {error || stepsResult.error ? (
          <p className="neutral-feedback" role="alert">Could not load projects. Refresh to try again.</p>
        ) : projects.length === 0 ? (
          <section className="neutral-panel p-8 text-center">
            <h2 className="text-lg font-semibold">No active projects</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Ask Claude to add long-term work as a project, then its breakdown will appear here.
            </p>
          </section>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Active projects">
            {projects.map((project) => {
              const steps = (stepsResult.data ?? []).filter(
                (step) => step.parent_id === project.id,
              );
              const doneSteps = steps.filter((step) => step.status === "done").length;
              const estimatedMinutes = steps.reduce(
                (total, step) => total + (step.est_minutes ?? 0),
                0,
              );
              const actualMinutes = steps.reduce(
                (total, step) => total + (step.actual_minutes ?? 0),
                0,
              );
              const progress = Math.max(
                progressPercent(doneSteps, steps.length),
                progressPercent(actualMinutes, estimatedMinutes),
              );
              return (
                <li key={project.id}>
                  <Link href={`/projects/${project.id}`} className="project-index-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {project.course ? <p className="page-kicker">{project.course}</p> : null}
                        <h2 className="mt-1 text-base font-semibold leading-snug">{project.title}</h2>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-[var(--muted)]">{progress}%</span>
                    </div>
                    <div className="project-progress-track mt-5">
                      <div style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                      <span>{doneSteps} of {steps.length} steps</span>
                      <span>{project.due_at ? `Due ${new Date(project.due_at).toLocaleDateString()}` : "No deadline"}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
