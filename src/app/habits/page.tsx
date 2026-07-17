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
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-6">
      <AppHeader />
      <main className="pt-8">
        <h1 className="text-2xl font-semibold">Habits</h1>
        <p className="mt-1 text-sm text-zinc-500">Thirty days, no points or reminders.</p>
        <div className="mt-6"><HabitGrid rows={rows} dates={dates} /></div>
      </main>
    </div>
  );
}
