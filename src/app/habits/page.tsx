import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { calculateHabitStats } from "@/lib/habits/stats";
import { createClient } from "@/lib/supabase/server";
import { HabitGrid } from "./habit-grid";

function requestDate(): Date {
  return new Date();
}

export default async function HabitsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from("habits").select("id, name, color, target_per_week").eq("user_id", user.id).eq("archived", false).order("name"),
    supabase.from("habit_logs").select("habit_id, date, done").eq("user_id", user.id).eq("done", true).order("date"),
  ]);
  const today = requestDate();
  const dates = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (29 - index), 12));
    return date.toISOString().slice(0, 10);
  });
  const rows = (habits ?? []).map((habit) => {
    const completedDates = (logs ?? []).filter((log) => log.habit_id === habit.id).map((log) => log.date);
    return {
      id: habit.id,
      name: habit.name,
      color: habit.color,
      targetPerWeek: habit.target_per_week,
      completedDates,
      ...calculateHabitStats(completedDates, today, habit.target_per_week),
    };
  });
  return (
    <div className="app-page" data-page="habits">
      <AppHeader />
      <main>
        <div className="page-intro">
          <div>
            <p className="page-kicker">Small actions, visible momentum</p>
            <h1 className="page-title">Habit tracker</h1>
            <p className="page-description">A quiet thirty-day view of the routines you want to keep. Tap any day to update it instantly.</p>
          </div>
          <div className="rounded-full bg-[var(--success-soft)] px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{rows.length} active {rows.length === 1 ? "habit" : "habits"}</div>
        </div>
        <div className="workspace-card"><HabitGrid rows={rows} dates={dates} /></div>
      </main>
    </div>
  );
}
