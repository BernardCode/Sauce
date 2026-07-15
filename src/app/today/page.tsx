import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { ItemList, type TodayItem } from "./item-list";

type ItemRow = {
  id: string;
  title: string;
  course: string | null;
  due_at: string | null;
  completed_at: string | null;
};

// Deliberately impure, so it lives outside the component body: the cutoff
// has to track the wall clock on every request. 48 hours back covers "done
// today" in every timezone the browser might be in; the client narrows the
// window to its own local day.
function doneCutoffIso(): string {
  return new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
}

function toTodayItem(row: ItemRow): TodayItem {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    dueAt: row.due_at,
    completedAt: row.completed_at,
  };
}

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The proxy already guards this route; this is defense in depth.
  if (!user) {
    redirect("/");
  }

  const doneCutoff = doneCutoffIso();

  const [openResult, doneResult] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, course, due_at, completed_at")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("due_at", { ascending: true }),
    supabase
      .from("items")
      .select("id, title, course, due_at, completed_at")
      .eq("user_id", user.id)
      .eq("status", "done")
      .gte("completed_at", doneCutoff)
      .order("completed_at", { ascending: false }),
  ]);

  const loadError = openResult.error ?? doneResult.error;
  const openItems = (openResult.data ?? []).map(toTodayItem);
  const doneItems = (doneResult.data ?? []).map(toTodayItem);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Today</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col">
        {loadError ? (
          <p className="flex flex-1 items-center justify-center text-zinc-500">
            Could not load your items. Refresh to try again.
          </p>
        ) : (
          <ItemList openItems={openItems} doneItems={doneItems} />
        )}
      </main>
    </div>
  );
}
