"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addItem } from "@/app/today/actions";
import {
  addSatMistake,
  logSatSession,
  reviewSatMistake,
  saveSatProfile,
} from "./actions";

type Profile = {
  testDate: string | null;
  targetScore: number;
  currentScore: number | null;
  weeklyMinutes: number;
};

type Session = {
  id: string;
  section: string;
  skill: string;
  mode: string;
  minutes: number;
  questions: number;
  correct: number;
  completedAt: string;
};

type Mistake = {
  id: string;
  section: string;
  skill: string;
  reason: string;
  takeaway: string;
  confidence: number;
  sourceUrl: string | null;
  nextReviewAt: string;
};

const mathSkills = [
  "Algebra",
  "Advanced Math",
  "Problem Solving",
  "Geometry and Trigonometry",
];

const readingSkills = [
  "Information and Ideas",
  "Craft and Structure",
  "Expression of Ideas",
  "Standard English Conventions",
];

function sectionLabel(section: string): string {
  return section === "math" ? "Math" : "Reading and Writing";
}

export function SatWorkspace({
  initialProfile,
  sessions,
  mistakes,
}: {
  initialProfile: Profile;
  sessions: Session[];
  mistakes: Mistake[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [sessionRows, setSessionRows] = useState(sessions);
  const [mistakeRows, setMistakeRows] = useState(mistakes);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);

  const weekMinutes = sessionRows
    .filter((session) => new Date(session.completedAt) >= weekStart)
    .reduce((sum, session) => sum + session.minutes, 0);
  const reviewedQuestions = sessionRows.reduce(
    (sum, session) => sum + session.questions,
    0,
  );
  const correctQuestions = sessionRows.reduce(
    (sum, session) => sum + session.correct,
    0,
  );
  const accuracy = reviewedQuestions
    ? Math.round((correctQuestions / reviewedQuestions) * 100)
    : 0;
  const daysUntil = profile.testDate
    ? Math.ceil(
        (new Date(`${profile.testDate}T12:00:00`).getTime() - now.getTime()) /
          86_400_000,
      )
    : null;
  const skillStats = new Map<string, { correct: number; questions: number }>();

  for (const session of sessionRows) {
    const entry = skillStats.get(session.skill) ?? { correct: 0, questions: 0 };
    entry.correct += session.correct;
    entry.questions += session.questions;
    skillStats.set(session.skill, entry);
  }

  const weakest = [...skillStats.entries()]
    .filter(([, value]) => value.questions >= 3)
    .sort(
      (a, b) =>
        a[1].correct / a[1].questions - b[1].correct / b[1].questions,
    )[0];

  function showResult(errorText: string | null, success: string) {
    setError(errorText);
    setMessage(errorText ? null : success);
  }

  function saveGoals() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveSatProfile(profile);
      showResult(result.error, "Goals saved.");
    });
  }

  function planPractice() {
    const due = new Date();
    due.setDate(due.getDate() + 1);
    due.setHours(20, 0, 0, 0);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await addItem({
        title: `SAT ${weakest?.[0] ?? "mixed practice"}`,
        dueAtIso: due.toISOString(),
        estMinutes: 45,
        isProject: false,
        course: "SAT",
        energy: "high",
      });
      showResult(result.error, "Added 45 minutes of SAT practice for tomorrow.");
    });
  }

  function logPractice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const session: Session = {
      id: crypto.randomUUID(),
      section: String(data.get("section")),
      skill: String(data.get("skill")),
      mode: String(data.get("mode")),
      minutes: Number(data.get("minutes")),
      questions: Number(data.get("questions")),
      correct: Number(data.get("correct")),
      completedAt: new Date().toISOString(),
    };

    setSessionRows((current) => [session, ...current]);
    setError(null);
    setMessage("Practice logged.");
    form.reset();
    startTransition(async () => {
      const result = await logSatSession({
        section: session.section,
        skill: session.skill,
        mode: session.mode,
        minutes: session.minutes,
        questions: session.questions,
        correct: session.correct,
      });
      if (result.error) {
        setSessionRows((current) =>
          current.filter((entry) => entry.id !== session.id),
        );
        showResult(result.error, "");
      }
    });
  }

  function logMistake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const mistake = {
      section: String(data.get("section")),
      skill: String(data.get("skill")),
      reason: String(data.get("reason")),
      takeaway: String(data.get("takeaway")),
      confidence: Number(data.get("confidence")),
      sourceUrl: String(data.get("sourceUrl") ?? ""),
    };

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await addSatMistake(mistake);
      showResult(result.error, "Added to spaced review.");
      if (!result.error) form.reset();
    });
  }

  function reviewMistake(mistake: Mistake, outcome: "again" | "resolved") {
    const previous = mistakeRows;
    setMistakeRows((current) =>
      current.filter((entry) => entry.id !== mistake.id),
    );
    setError(null);
    setMessage(outcome === "resolved" ? "Review completed." : "Review rescheduled.");
    startTransition(async () => {
      const result = await reviewSatMistake({ id: mistake.id, outcome });
      if (result.error) {
        setMistakeRows(previous);
        showResult(result.error, "");
      }
    });
  }

  return (
    <div className="sat-workspace">
      <section className="neutral-panel sat-plan-panel">
        <header className="neutral-panel-header">
          <div className="neutral-panel-heading">
            <span className="neutral-panel-label">This week</span>
            <span className="neutral-panel-count">{weekMinutes}m</span>
          </div>
          <span className="neutral-panel-note">
            {daysUntil === null ? "Set test date" : `${Math.max(0, daysUntil)} days to test`}
          </span>
        </header>
        <div className="neutral-list">
          <article className="neutral-row sat-next-row">
            <div className="neutral-row-copy">
              <h2>
                {weakest
                  ? `Strengthen ${weakest[0]}`
                  : "Log a practice set to personalize your plan"}
              </h2>
              <p>
                {daysUntil === null
                  ? "Add your test date, then log one practice set."
                  : `${Math.max(0, profile.weeklyMinutes - weekMinutes)} minutes remain in your weekly target.`}
              </p>
            </div>
            <div className="neutral-row-actions">
              <a
                href="https://satsuitequestionbank.collegeboard.org/"
                target="_blank"
                rel="noreferrer"
                className="neutral-secondary-button"
              >
                Question bank
              </a>
              <button
                type="button"
                onClick={planPractice}
                disabled={isPending}
                className="neutral-primary-button"
              >
                Plan 45 minutes
              </button>
            </div>
          </article>
          <div className="sat-metric-row" aria-label="SAT progress">
            <div><strong>{weekMinutes}</strong><span>minutes this week</span></div>
            <div><strong>{accuracy}%</strong><span>practice accuracy</span></div>
            <div><strong>{mistakeRows.length}</strong><span>reviews due</span></div>
          </div>
        </div>
      </section>

      {error ? <p className="neutral-feedback" role="alert">{error}</p> : null}
      {message ? <p className="neutral-feedback" role="status">{message}</p> : null}

      <div className="sat-content-grid">
        <div className="sat-primary-column">
          <section className="neutral-panel">
            <header className="neutral-panel-header">
              <div className="neutral-panel-heading">
                <span className="neutral-panel-label">Goals</span>
              </div>
            </header>
            <div className="neutral-form-row sat-goals-grid">
              <label>
                Test date
                <input
                  type="date"
                  value={profile.testDate ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      testDate: event.target.value || null,
                    })
                  }
                />
              </label>
              <label>
                Current score
                <input
                  type="number"
                  min={400}
                  max={1600}
                  value={profile.currentScore ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      currentScore: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </label>
              <label>
                Target score
                <input
                  type="number"
                  min={400}
                  max={1600}
                  value={profile.targetScore}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      targetScore: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Minutes per week
                <input
                  type="number"
                  min={30}
                  max={2100}
                  value={profile.weeklyMinutes}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      weeklyMinutes: Number(event.target.value),
                    })
                  }
                />
              </label>
              <button
                type="button"
                onClick={saveGoals}
                disabled={isPending}
                className="neutral-primary-button sat-form-submit"
              >
                Save goals
              </button>
            </div>
          </section>

          <section className="neutral-panel">
            <header className="neutral-panel-header">
              <div className="neutral-panel-heading">
                <span className="neutral-panel-label">Practice</span>
              </div>
            </header>
            <form onSubmit={logPractice} className="neutral-form-row sat-practice-grid">
              <select name="section" aria-label="SAT section">
                <option value="math">Math</option>
                <option value="reading_writing">Reading and Writing</option>
              </select>
              <input name="skill" required list="sat-skills" placeholder="Skill practiced" />
              <datalist id="sat-skills">{[...mathSkills, ...readingSkills].map((skill) => <option key={skill} value={skill} />)}</datalist>
              <select name="mode" aria-label="Practice mode">
                <option value="timed">Timed</option>
                <option value="untimed">Untimed</option>
                <option value="review">Mistake review</option>
              </select>
              <input name="minutes" required type="number" min={1} max={600} placeholder="Minutes" />
              <input name="questions" required type="number" min={1} max={200} placeholder="Questions" />
              <input name="correct" required type="number" min={0} max={200} placeholder="Correct" />
              <button disabled={isPending} className="neutral-primary-button sat-form-submit">Save practice</button>
            </form>
          </section>

          <section className="neutral-panel">
            <header className="neutral-panel-header">
              <div className="neutral-panel-heading">
                <span className="neutral-panel-label">Mistake log</span>
              </div>
            </header>
            <form onSubmit={logMistake} className="neutral-form-row sat-mistake-grid">
              <select name="section" aria-label="SAT section">
                <option value="math">Math</option>
                <option value="reading_writing">Reading and Writing</option>
              </select>
              <input name="skill" required list="sat-skills" placeholder="Skill" />
              <input name="reason" required placeholder="Why did you miss it?" className="sat-wide-field" />
              <textarea name="takeaway" placeholder="Rule or takeaway for next time" className="sat-wide-field" />
              <input name="sourceUrl" type="url" placeholder="Optional question link" />
              <label>Confidence, 1 to 5<input name="confidence" type="number" min={1} max={5} defaultValue={2} /></label>
              <button disabled={isPending} className="neutral-primary-button sat-form-submit">Add to review queue</button>
            </form>
          </section>
        </div>

        <aside className="sat-secondary-column">
          <section className="neutral-panel">
            <header className="neutral-panel-header">
              <div className="neutral-panel-heading">
                <span className="neutral-panel-label">Review queue</span>
                <span className="neutral-panel-count">{mistakeRows.length}</span>
              </div>
            </header>
            <div className="neutral-list">
              {mistakeRows.map((mistake) => (
                <article key={mistake.id} className="neutral-row sat-review-row">
                  <div className="neutral-row-copy">
                    <div className="sat-row-heading">
                      <h3>{mistake.skill}</h3>
                      <span>{sectionLabel(mistake.section)}</span>
                    </div>
                    <p>{mistake.reason}</p>
                    {mistake.takeaway ? <small>Remember: {mistake.takeaway}</small> : null}
                  </div>
                  <div className="neutral-row-actions sat-review-actions">
                    {mistake.sourceUrl ? (
                      <a href={mistake.sourceUrl} target="_blank" rel="noreferrer">
                        Source
                      </a>
                    ) : (
                      <span>Confidence {mistake.confidence}/5</span>
                    )}
                    <button type="button" disabled={isPending} onClick={() => reviewMistake(mistake, "again")}>Again</button>
                    <button type="button" disabled={isPending} onClick={() => reviewMistake(mistake, "resolved")}>Got it</button>
                  </div>
                </article>
              ))}
              {!mistakeRows.length ? <p className="neutral-empty-row">Your review queue is clear.</p> : null}
            </div>
          </section>

          <section className="neutral-panel">
            <header className="neutral-panel-header">
              <div className="neutral-panel-heading">
                <span className="neutral-panel-label">Recent practice</span>
                <span className="neutral-panel-count">{sessionRows.length}</span>
              </div>
            </header>
            <div className="neutral-list">
              {sessionRows.slice(0, 8).map((session) => (
                <article key={session.id} className="neutral-row sat-session-row">
                  <strong>{Math.round((session.correct / session.questions) * 100)}%</strong>
                  <div className="neutral-row-copy">
                    <h3>{session.skill}</h3>
                    <p>{session.questions} questions, {session.minutes} minutes</p>
                  </div>
                </article>
              ))}
              {!sessionRows.length ? <p className="neutral-empty-row">No practice logged yet.</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
