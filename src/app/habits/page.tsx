import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { habitIsDue } from "@/lib/habits/due";
import { calculateHabitStats } from "@/lib/habits/stats";
import { habitDaysSchema } from "@/lib/planner/schemas";
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
    supabase.from("habits").select("id, name, cadence, days_json, target_per_week, scheduled_time").eq("user_id", user.id).eq("archived", false).order("name"),
    supabase.from("habit_logs").select("habit_id, date, done").eq("user_id", user.id).eq("done", true).order("date"),
  ]);
  const today = requestDate();
  const dates = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (29 - index), 12));
    return date.toISOString().slice(0, 10);
  });
  const rows = (habits ?? []).map((habit) => {
    const completedDates = (logs ?? []).filter((log) => log.habit_id === habit.id).map((log) => log.date);
    const parsedDays = habitDaysSchema.safeParse(habit.days_json ?? []);
    const days = parsedDays.success ? parsedDays.data : [];
    return {
      id: habit.id,
      name: habit.name,
      cadence: habit.cadence,
      days,
      scheduledTime: habit.scheduled_time?.slice(0, 5) ?? null,
      todayDue: habitIsDue(habit.cadence, days, today.getUTCDay()),
      completedDates,
      ...calculateHabitStats(completedDates, today, habit.target_per_week),
    };
  });
  return (
    <div className="app-page" data-page="habits">
      <AppHeader />
      <main>
        <div className="page-intro">
          <h1 className="page-title">Habits</h1>
        </div>
        <HabitGrid rows={rows} dates={dates} todayDate={dates[dates.length - 1]} />
      </main>
    </div>
  );
}
