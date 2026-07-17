import { redirect } from "next/navigation";
import { z } from "zod";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { AssignmentBoard } from "./assignment-board";

const querySchema = z.object({ filter: z.enum(["all", "overdue", "unscheduled", "projects"]).default("all") });

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const rawQuery = await searchParams;
  const query = querySchema.safeParse({ filter: typeof rawQuery.filter === "string" ? rawQuery.filter : undefined });
  const initialFilter = query.success ? query.data.filter : "all";
  const [{ data: items }, { data: blocks }] = await Promise.all([
    supabase.from("items").select("id, title, course, due_at, energy, priority, remaining_minutes, actual_minutes, is_project").eq("user_id", user.id).eq("status", "open").is("parent_id", null).order("due_at", { nullsFirst: false }),
    supabase.from("blocks").select("item_id, start_at").eq("user_id", user.id).eq("done", false).gte("end_at", new Date().toISOString()).order("start_at"),
  ]);
  const firstBlock = new Map<string, string>();
  for (const block of blocks ?? []) if (block.item_id && !firstBlock.has(block.item_id)) firstBlock.set(block.item_id, block.start_at);
  return (
    <div className="app-page" data-page="assignments">
      <AppHeader />
      <main>
        <div className="page-intro"><div><p className="page-kicker">Every obligation, one clear list</p><h1 className="page-title">Assignments</h1><p className="page-description">Capture work, sort it by course, match it to your energy, and record progress without opening an editor.</p></div><div className="rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-deep)]">{items?.length ?? 0} open</div></div>
        <div className="workspace-card"><AssignmentBoard initialFilter={initialFilter} initialRows={(items ?? []).map((item) => ({ id: item.id, title: item.title, course: item.course, dueAt: item.due_at, energy: item.energy as "low" | "medium" | "high", priority: item.priority as "low" | "normal" | "high", remainingMinutes: item.remaining_minutes, actualMinutes: item.actual_minutes, isProject: item.is_project, scheduledAt: firstBlock.get(item.id) ?? null }))} /></div>
      </main>
    </div>
  );
}
