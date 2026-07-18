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
  origin: string;
};

const itemColumns =
  "id, title, course, due_at, est_minutes, is_project, origin";

function staleSourceCutoffMs(): number {
  return Date.now() - 15 * 60 * 1000;
}

function toTodayItem(row: ItemRow): TodayItem {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    dueAt: row.due_at,
    estMinutes: row.est_minutes,
    isProject: row.is_project,
    origin: row.origin,
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

  // Manual work and synced school assignments intentionally share this query.
  const openResult = await supabase
    .from("items")
    .select(itemColumns)
    .eq("user_id", user.id)
    .eq("status", "open")
    .is("parent_id", null)
    .order("due_at", { ascending: true, nullsFirst: false });

  const openItems = ((openResult.data ?? []) as ItemRow[]).map(toTodayItem);
  const loadError = openResult.error;

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
