import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { calculateHabitStats } from "@/lib/habits/stats";
import { habitDaysSchema } from "@/lib/planner/schemas";
import { localParts, safeTimeZone } from "@/lib/planner/time";
import { createClient } from "@/lib/supabase/server";
import { HabitGrid } from "./habit-grid";

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function HabitsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const [{ data: habits }, { data: logs }, { data: profile }] = await Promise.all([
    supabase.from("habits").select("id, name, cadence, days_json, target_per_week, color, scheduled_time").eq("user_id", user.id).eq("archived", false).order("name"),
    supabase.from("habit_logs").select("habit_id, date, done").eq("user_id", user.id).eq("done", true).order("date"),
    supabase.from("users").select("timezone").eq("id", user.id).maybeSingle(),
  ]);
  const todayKey = localParts(
    new Date(),
    safeTimeZone(profile?.timezone ?? "UTC"),
  ).date;
  const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);
  const today = new Date(
    todayYear,
    todayMonth - 1,
    todayDay,
    12,
  );
  const daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
    12,
  ).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      index + 1,
      12,
    );
    return localDateKey(date);
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
      targetPerWeek: habit.target_per_week,
      color: habit.color,
      scheduledTime: habit.scheduled_time?.slice(0, 5) ?? null,
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
        <HabitGrid
          rows={rows}
          monthDates={monthDates}
          todayDate={todayKey}
        />
      </main>
    </div>
  );
}
