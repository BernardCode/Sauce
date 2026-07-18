import { redirect } from "next/navigation";
import { after } from "next/server";
import { AppHeader } from "@/app/components/app-header";
import { syncCalendarSource } from "@/lib/calendar/sync-source";
import { createClient } from "@/lib/supabase/server";
import { ItemList, type TodayItem } from "./item-list";

type ItemRow = {
  id: string;
  title: string;
  course: string | null;
  due_at: string | null;
  est_minutes: number | null;
  is_project: boolean;
  parent_id: string | null;
};

const itemColumns =
  "id, title, course, due_at, est_minutes, is_project, parent_id";

function staleSourceCutoffMs(): number {
  return Date.now() - 15 * 60 * 1000;
}

function toTodayItem(
  row: ItemRow,
  projects: Map<string, ItemRow>,
): TodayItem {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    dueAt: row.due_at,
    estMinutes: row.est_minutes,
    isProject: row.is_project,
    parentTitle: row.parent_id
      ? (projects.get(row.parent_id)?.title ?? "Project")
      : null,
  };
}

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: sources } = await supabase
    .from("sources")
    .select("id, kind, enabled, last_synced_at")
    .eq("user_id", user.id);
  const staleCutoff = staleSourceCutoffMs();
  const staleSources = (sources ?? []).filter(
    (source) =>
      source.enabled &&
      ["gcal", "ics"].includes(source.kind) &&
      (!source.last_synced_at ||
        new Date(source.last_synced_at).getTime() < staleCutoff),
  );

  if (staleSources.length) {
    after(async () => {
      await Promise.allSettled(
        staleSources.map((source) => syncCalendarSource(source)),
      );
    });
  }

  const [openResult, projectItemsResult] = await Promise.all([
    supabase
      .from("items")
      .select(itemColumns)
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(24),
    supabase
      .from("items")
      .select(itemColumns)
      .eq("user_id", user.id)
      .or("is_project.eq.true,parent_id.not.is.null"),
  ]);

  const projectRows = (projectItemsResult.data ?? []) as ItemRow[];
  const projects = new Map(
    projectRows
      .filter((item) => item.is_project)
      .map((item) => [item.id, item]),
  );
  const openItems = ((openResult.data ?? []) as ItemRow[]).map((item) =>
    toTodayItem(item, projects),
  );
  const loadError = openResult.error ?? projectItemsResult.error;

  return (
    <div className="app-page" data-page="today">
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <div className="today-task-page">
          <header className="today-simple-header">
            <h1 className="page-title">Today</h1>
          </header>
          {loadError ? (
            <p className="today-empty-state">
              Could not load your tasks. Refresh to try again.
            </p>
          ) : (
            <ItemList openItems={openItems} />
          )}
        </div>
      </main>
    </div>
  );
}
