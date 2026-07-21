"use client";

import { useState, useTransition } from "react";
import { reviewSatMistake } from "../actions";

type Mistake = {
  id: string;
  section: string | null;
  skill: string | null;
  reflection: string;
  nextReviewAt: string;
  screenshotUrl: string | null;
};

type PracticeTest = {
  id: string;
  testDate: string;
  totalScore: number;
  mathScore: number;
  readingWritingScore: number;
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

function sectionLabel(section: string): string {
  return section === "math" ? "Math" : "Reading and Writing";
}

function dateLabel(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" },
  );
}

export function SatReviewWorkspace({
  mistakes,
  practiceTests,
  sessions,
}: {
  mistakes: Mistake[];
  practiceTests: PracticeTest[];
  sessions: Session[];
}) {
  const [mistakeRows, setMistakeRows] = useState(mistakes);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reviewMistake(mistake: Mistake, outcome: "again" | "resolved") {
    const previous = mistakeRows;
    setMistakeRows((current) =>
      current.filter((entry) => entry.id !== mistake.id),
    );
    setError(null);
    setMessage(
      outcome === "resolved" ? "Review completed." : "Review rescheduled.",
    );
    startTransition(async () => {
      const result = await reviewSatMistake({ id: mistake.id, outcome });
      if (result.error) {
        setMistakeRows(previous);
        setError(result.error);
        setMessage(null);
      }
    });
  }

  return (
    <div className="sat-review-workspace">
      {error ? <p className="neutral-feedback" role="alert">{error}</p> : null}
      {message ? <p className="neutral-feedback" role="status">{message}</p> : null}

      <section className="sat-review-panel" aria-labelledby="sat-review-heading">
        <header className="sat-section-heading">
          <div>
            <h2 id="sat-review-heading">Mistakes to review</h2>
            <p>Your saved explanation stays with every question.</p>
          </div>
          <span>{mistakeRows.length}</span>
        </header>
        <div className="sat-review-list">
          {mistakeRows.map((mistake) => (
            <article key={mistake.id} className="sat-review-item">
              {mistake.screenshotUrl ? (
                <a
                  href={mistake.screenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="sat-review-screenshot"
                  style={{ backgroundImage: `url(${mistake.screenshotUrl})` }}
                  aria-label={`Open screenshot for ${mistake.skill ?? "saved SAT mistake"}`}
                />
              ) : null}
              <div className="sat-review-copy">
                {mistake.skill || mistake.section ? (
                  <div className="sat-review-title-row">
                    {mistake.skill ? <h3>{mistake.skill}</h3> : null}
                    {mistake.section ? (
                      <span>{sectionLabel(mistake.section)}</span>
                    ) : null}
                  </div>
                ) : null}
                <p>{mistake.reflection}</p>
                <small>Review {dateLabel(mistake.nextReviewAt)}</small>
              </div>
              <div className="sat-review-buttons">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => reviewMistake(mistake, "again")}
                  className="neutral-secondary-button"
                >
                  Again
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => reviewMistake(mistake, "resolved")}
                  className="neutral-primary-button"
                >
                  Got it
                </button>
              </div>
            </article>
          ))}
          {!mistakeRows.length ? (
            <p className="neutral-empty-row">Your review queue is clear.</p>
          ) : null}
        </div>
      </section>

      <section className="sat-data-panel" aria-labelledby="sat-score-history-heading">
        <header className="sat-section-heading">
          <div>
            <h2 id="sat-score-history-heading">Practice test scores</h2>
            <p>Saved full-length practice test results.</p>
          </div>
        </header>
        <div className="sat-data-list">
          {practiceTests.map((test) => (
            <article key={test.id} className="sat-score-row">
              <strong>{test.totalScore}</strong>
              <div>
                <h3>{dateLabel(test.testDate)}</h3>
                <p>Math {test.mathScore}, Reading and Writing {test.readingWritingScore}</p>
              </div>
            </article>
          ))}
          {!practiceTests.length ? (
            <p className="neutral-empty-row">No practice test scores yet.</p>
          ) : null}
        </div>
      </section>

      <section className="sat-data-panel" aria-labelledby="sat-practice-history-heading">
        <header className="sat-section-heading">
          <div>
            <h2 id="sat-practice-history-heading">Practice log</h2>
            <p>Your existing practice history.</p>
          </div>
        </header>
        <div className="sat-data-list">
          {sessions.map((session) => (
            <article key={session.id} className="sat-session-row">
              <strong>
                {Math.round((session.correct / session.questions) * 100)}%
              </strong>
              <div>
                <h3>{session.skill}</h3>
                <p>
                  {sectionLabel(session.section)}, {session.questions} questions, {session.minutes} minutes, {dateLabel(session.completedAt)}
                </p>
              </div>
            </article>
          ))}
          {!sessions.length ? (
            <p className="neutral-empty-row">No practice logged yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
