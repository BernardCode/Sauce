import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { SatWorkspace } from "./sat-workspace";

export default async function SatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const today = new Date().toISOString().slice(0, 10);
  const [profileResult, sessionsResult, mistakesResult] = await Promise.all([
    supabase.from("sat_profiles").select("test_date, target_score, current_score, weekly_minutes").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("sat_sessions")
      .select("id, section, skill, mode, minutes, questions, correct, completed_at")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(60),
    supabase
      .from("sat_mistakes")
      .select("id, section, skill, reason, takeaway, confidence, source_url, next_review_at")
      .eq("user_id", user.id)
      .eq("resolved", false)
      .lte("next_review_at", today)
      .order("next_review_at"),
  ]);
  const profile = profileResult.data;
  const sessions = (sessionsResult.data ?? []).map((session) => ({
    id: session.id,
    section: session.section,
    skill: session.skill,
    mode: session.mode,
    minutes: session.minutes,
    questions: session.questions,
    correct: session.correct,
    completedAt: session.completed_at,
  }));
  const mistakes = (mistakesResult.data ?? []).map((mistake) => ({
    id: mistake.id,
    section: mistake.section,
    skill: mistake.skill,
    reason: mistake.reason,
    takeaway: mistake.takeaway,
    confidence: mistake.confidence,
    sourceUrl: mistake.source_url,
    nextReviewAt: mistake.next_review_at,
  }));
  const workspaceKey = [
    sessions.map((session) => session.id).join(":"),
    mistakes.map((mistake) => mistake.id).join(":"),
    profile?.test_date,
    profile?.target_score,
    profile?.current_score,
    profile?.weekly_minutes,
  ].join("|");

  return (
    <div className="app-page" data-page="sat">
      <AppHeader />
      <main>
        <div className="page-intro">
          <h1 className="page-title">SAT studio</h1>
        </div>
        <SatWorkspace
          key={workspaceKey}
          initialProfile={{
            testDate: profile?.test_date ?? null,
            targetScore: profile?.target_score ?? 1400,
            currentScore: profile?.current_score ?? null,
            weeklyMinutes: profile?.weekly_minutes ?? 240,
          }}
          sessions={sessions}
          mistakes={mistakes}
        />
      </main>
    </div>
  );
}
