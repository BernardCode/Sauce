import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, CalendarRange, CheckCircle2, CircleAlert, Flame, Gauge } from "lucide-react";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { RecentCompletions } from "./recent-completions";

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const nextWeek = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const dateWeekAgo = weekAgo.slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const [doneResult, blocksResult, habitsResult, satResult, upcomingResult, profileResult] = await Promise.all([
    supabase.from("items").select("id, title, course, completed_at, actual_minutes").eq("user_id", user.id).eq("status", "done").gte("completed_at", weekAgo).order("completed_at", { ascending: false }),
    supabase.from("blocks").select("done, actual_minutes, start_at, end_at").eq("user_id", user.id).gte("start_at", weekAgo).lte("start_at", now.toISOString()),
    supabase.from("habit_logs").select("habit_id, date, done").eq("user_id", user.id).eq("done", true).gte("date", dateWeekAgo).lte("date", today),
    supabase.from("sat_sessions").select("minutes, questions, correct, skill").eq("user_id", user.id).gte("completed_at", weekAgo),
    supabase.from("items").select("id, title, course, due_at, remaining_minutes, priority").eq("user_id", user.id).eq("status", "open").not("due_at", "is", null).lte("due_at", nextWeek).order("due_at"),
    supabase.from("sat_profiles").select("weekly_minutes").eq("user_id", user.id).maybeSingle(),
  ]);
  const done = doneResult.data ?? [];
  const blocks = blocksResult.data ?? [];
  const habits = habitsResult.data ?? [];
  const sat = satResult.data ?? [];
  const upcoming = upcomingResult.data ?? [];
  const planned = Math.round(blocks.reduce((sum, block) => sum + (new Date(block.end_at).getTime() - new Date(block.start_at).getTime()) / 60_000, 0));
  const actual = blocks.reduce((sum, block) => sum + (block.actual_minutes ?? 0), 0);
  const satMinutes = sat.reduce((sum, session) => sum + session.minutes, 0);
  const satQuestions = sat.reduce((sum, session) => sum + session.questions, 0);
  const satCorrect = sat.reduce((sum, session) => sum + session.correct, 0);
  const uniqueHabitDays = new Set(habits.map((log) => log.date)).size;
  const overloaded = upcoming.filter((item) => (item.remaining_minutes ?? 0) >= 120 || item.priority === "high");
  return (
    <div className="app-page" data-page="review"><AppHeader /><main>
      <div className="page-intro"><div><p className="page-kicker">Reset with honest information</p><h1 className="page-title">Weekly review</h1><p className="page-description">See what moved, what slipped, and what next week is asking from you before Monday decides for you.</p></div><Link href="/calendar?view=week" className="motion-forward inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Plan next week <ArrowRight size={15} /></Link></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="workspace-card"><CheckCircle2 size={19} className="text-emerald-500" /><p className="mt-4 text-3xl font-semibold">{done.length}</p><p className="text-sm text-[var(--muted)]">assignments completed</p></div><div className="workspace-card"><Gauge size={19} className="text-sky-500" /><p className="mt-4 text-3xl font-semibold">{actual}<span className="text-base text-[var(--muted)]">/{planned}m</span></p><p className="text-sm text-[var(--muted)]">focused versus planned</p></div><div className="workspace-card"><Flame size={19} className="text-amber-500" /><p className="mt-4 text-3xl font-semibold">{uniqueHabitDays}<span className="text-base text-[var(--muted)]">/7</span></p><p className="text-sm text-[var(--muted)]">days with a habit win</p></div><div className="workspace-card"><BookOpenCheck size={19} className="text-[var(--task-accent)]" /><p className="mt-4 text-3xl font-semibold">{satQuestions ? Math.round(satCorrect / satQuestions * 100) : 0}%</p><p className="text-sm text-[var(--muted)]">SAT accuracy, {satMinutes}/{profileResult.data?.weekly_minutes ?? 240}m</p></div></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="workspace-card"><div className="flex items-center gap-2"><CalendarRange size={18} className="text-[var(--primary)]" /><h2 className="font-semibold">Next seven days</h2></div><div className="mt-4 flex flex-col gap-2">{upcoming.map((item) => <Link key={item.id} href="/today" className="flex items-center gap-3 rounded-xl bg-[var(--surface-subtle)] p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="text-xs text-[var(--muted)]">{item.course ?? "General"}, due {new Date(item.due_at as string).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</p></div><span className="text-xs font-semibold text-[var(--primary)]">{item.remaining_minutes ?? "?"}m</span></Link>)}{!upcoming.length ? <p className="py-8 text-center text-sm text-[var(--muted)]">No deadlines in the next seven days.</p> : null}</div></section><section className="workspace-card"><div className="flex items-center gap-2"><CircleAlert size={18} className={overloaded.length ? "text-rose-500" : "text-emerald-500"} /><h2 className="font-semibold">Decisions to make</h2></div><div className="mt-4 flex flex-col gap-3">{overloaded.map((item) => <div key={item.id} className="rounded-xl border border-amber-200 bg-[var(--warning-soft)] p-3 dark:border-amber-900"><p className="text-sm font-semibold">Start {item.title} early</p><p className="mt-1 text-xs text-[var(--muted)]">It has {item.remaining_minutes ?? "unknown"} minutes remaining and is due soon.</p></div>)}{satMinutes < (profileResult.data?.weekly_minutes ?? 240) ? <div className="rounded-xl bg-[var(--primary-soft)] p-3"><p className="text-sm font-semibold text-[var(--primary-deep)]">Protect SAT time</p><p className="mt-1 text-xs text-[var(--muted)]">You are {Math.max(0, (profileResult.data?.weekly_minutes ?? 240) - satMinutes)} minutes short of this week&apos;s target.</p></div> : null}{!overloaded.length && satMinutes >= (profileResult.data?.weekly_minutes ?? 240) ? <p className="py-8 text-center text-sm text-[var(--muted)]">Nothing needs rescuing. Keep the plan realistic.</p> : null}</div></section></div>
      <RecentCompletions
        items={done.flatMap((item) => item.completed_at ? [{ id: item.id, title: item.title, course: item.course, completedAt: item.completed_at }] : [])}
      />
    </main></div>
  );
}
