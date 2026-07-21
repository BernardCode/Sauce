import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { SatReviewWorkspace } from "./sat-review-workspace";

export default async function SatReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [mistakesResult, sessionsResult, testsResult] = await Promise.all([
    supabase
      .from("sat_mistakes")
      .select("id, section, skill, reason, next_review_at, screenshot_path")
      .eq("user_id", user.id)
      .eq("resolved", false)
      .order("next_review_at"),
    supabase
      .from("sat_sessions")
      .select("id, section, skill, mode, minutes, questions, correct, completed_at")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(60),
    supabase
      .from("sat_practice_tests")
      .select("id, test_date, total_score, math_score, reading_writing_score")
      .eq("user_id", user.id)
      .order("test_date", { ascending: false })
      .limit(30),
  ]);

  const mistakes = await Promise.all(
    (mistakesResult.data ?? []).map(async (mistake) => {
      let screenshotUrl: string | null = null;
      if (mistake.screenshot_path) {
        const { data } = await supabase.storage
          .from("sat-mistakes")
          .createSignedUrl(mistake.screenshot_path, 60 * 60);
        screenshotUrl = data?.signedUrl ?? null;
      }
      return {
        id: mistake.id,
        section: mistake.section,
        skill: mistake.skill,
        reflection: mistake.reason,
        nextReviewAt: mistake.next_review_at,
        screenshotUrl,
      };
    }),
  );

  return (
    <div className="app-page" data-page="sat-review">
      <AppHeader />
      <main>
        <div className="page-intro sat-review-intro">
          <div>
            <h1 className="page-title">SAT review</h1>
            <p className="page-description">
              Review mistakes and scan your saved practice data.
            </p>
          </div>
          <Link href="/sat" className="neutral-secondary-button">
            Back to SAT studio
          </Link>
        </div>
        <SatReviewWorkspace
          mistakes={mistakes}
          practiceTests={(testsResult.data ?? []).map((test) => ({
            id: test.id,
            testDate: test.test_date,
            totalScore: test.total_score,
            mathScore: test.math_score,
            readingWritingScore: test.reading_writing_score,
          }))}
          sessions={(sessionsResult.data ?? []).map((session) => ({
            id: session.id,
            section: session.section,
            skill: session.skill,
            mode: session.mode,
            minutes: session.minutes,
            questions: session.questions,
            correct: session.correct,
            completedAt: session.completed_at,
          }))}
        />
      </main>
    </div>
  );
}
