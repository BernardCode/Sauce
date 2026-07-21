"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type DragEvent as ReactDragEvent,
  type FormEvent,
} from "react";
import { SAT_TEST_DATES } from "@/lib/sat/test-dates";
import {
  addSatMistake,
  logSatPracticeTest,
  saveSatTestDates,
} from "./actions";

const allowedScreenshotTypes = ["image/png", "image/jpeg", "image/webp"];
const maxScreenshotBytes = 5 * 1024 * 1024;

function todayDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function testDateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function screenshotError(file: File): string | null {
  if (!allowedScreenshotTypes.includes(file.type)) {
    return "Use a PNG, JPEG, or WebP screenshot.";
  }
  if (file.size > maxScreenshotBytes) {
    return "The screenshot must be 5 MB or smaller.";
  }
  return null;
}

export function SatWorkspace({
  initialTestDates,
}: {
  initialTestDates: string[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTestDates, setSelectedTestDates] = useState(initialTestDates);
  const [datesSaved, setDatesSaved] = useState(initialTestDates.length > 0);
  const [showScoreForm, setShowScoreForm] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function selectScreenshot(file: File) {
    const validationError = screenshotError(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setMessage(null);
    setScreenshot(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const image = Array.from(event.clipboardData?.files ?? []).find((file) =>
        file.type.startsWith("image/"),
      );
      if (!image) return;
      event.preventDefault();
      const validationError = screenshotError(image);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      setMessage("Screenshot pasted.");
      setScreenshot(image);
      setPreviewUrl(URL.createObjectURL(image));
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function showResult(errorText: string | null, success: string) {
    setError(errorText);
    setMessage(errorText ? null : success);
  }

  function toggleTestDate(testDate: string) {
    setSelectedTestDates((current) =>
      current.includes(testDate)
        ? current.filter((date) => date !== testDate)
        : [...current, testDate].sort(),
    );
  }

  function saveDates() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveSatTestDates({ testDates: selectedTestDates });
      showResult(result.error, "SAT test dates saved.");
      if (!result.error) setDatesSaved(true);
    });
  }

  function logMistake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (screenshot) data.set("screenshot", screenshot);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await addSatMistake(data);
      showResult(result.error, "Mistake saved for review.");
      if (result.error) return;
      form.reset();
      setScreenshot(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function logPracticeTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await logSatPracticeTest({
        testDate: String(data.get("testDate")),
        totalScore: Number(data.get("totalScore")),
        mathScore: Number(data.get("mathScore")),
        readingWritingScore: Number(data.get("readingWritingScore")),
      });
      showResult(result.error, "Practice test score saved.");
      if (!result.error) {
        form.reset();
        setShowScoreForm(false);
      }
    });
  }

  function handleDrop(event: ReactDragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const image = Array.from(event.dataTransfer.files).find((file) =>
      file.type.startsWith("image/"),
    );
    if (image) selectScreenshot(image);
  }

  return (
    <div className="sat-workspace sat-capture-workspace">
      <div className="sat-page-controls">
        {!datesSaved ? (
          <div className="sat-date-control">
            <details className="sat-date-picker">
              <summary>
                {selectedTestDates.length
                  ? `${selectedTestDates.length} test ${selectedTestDates.length === 1 ? "date" : "dates"} selected`
                  : "Choose SAT test dates"}
              </summary>
              <fieldset>
                <legend>Official 2026 to 2027 SAT dates</legend>
                {SAT_TEST_DATES.map((testDate) => (
                  <label key={testDate}>
                    <input
                      type="checkbox"
                      checked={selectedTestDates.includes(testDate)}
                      onChange={() => toggleTestDate(testDate)}
                    />
                    <span>{testDateLabel(testDate)}</span>
                  </label>
                ))}
              </fieldset>
            </details>
            <button
              type="button"
              onClick={saveDates}
              disabled={isPending || selectedTestDates.length === 0}
              className="neutral-secondary-button"
            >
              Save dates
            </button>
          </div>
        ) : null}
        <div className="sat-page-actions">
          <button
            type="button"
            onClick={() => setShowScoreForm((current) => !current)}
            className="neutral-secondary-button"
            aria-expanded={showScoreForm}
          >
            Log practice test score
          </button>
          <Link href="/sat/review" className="neutral-primary-button">
            Review mistakes and data
          </Link>
        </div>
      </div>

      {showScoreForm ? (
        <form onSubmit={logPracticeTest} className="sat-score-form">
          <label>
            Practice date
            <input name="testDate" type="date" defaultValue={todayDate()} required />
          </label>
          <label>
            Total score
            <input name="totalScore" type="number" min={400} max={1600} required />
          </label>
          <label>
            Math
            <input name="mathScore" type="number" min={200} max={800} required />
          </label>
          <label>
            Reading and Writing
            <input name="readingWritingScore" type="number" min={200} max={800} required />
          </label>
          <button disabled={isPending} className="neutral-primary-button">
            Save score
          </button>
        </form>
      ) : null}

      {error ? <p className="neutral-feedback" role="alert">{error}</p> : null}
      {message ? <p className="neutral-feedback" role="status">{message}</p> : null}

      <section className="sat-log-panel" aria-labelledby="sat-log-heading">
        <header>
          <h2 id="sat-log-heading">Mistake log</h2>
        </header>
        <form onSubmit={logMistake} className="sat-log-form">
          <div className="sat-log-capture">
            <textarea
              className="sat-reflection-input"
              name="reflection"
              required
              maxLength={2000}
              aria-label="Mistake explanation"
              placeholder="Explain the mistake and what to do next time."
            />
            <div className="sat-screenshot-column">
              <label
                className="sat-screenshot-field"
                data-has-image={Boolean(previewUrl)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  name="screenshot"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) selectScreenshot(file);
                  }}
                />
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Selected SAT question screenshot"
                    width={600}
                    height={600}
                    unoptimized
                  />
                ) : (
                  <span>
                    <strong>Add screenshot</strong>
                    <small>Paste anywhere or choose a file.</small>
                  </span>
                )}
              </label>
              {screenshot ? (
                <button
                  type="button"
                  className="sat-remove-screenshot"
                  onClick={() => {
                    setScreenshot(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Remove screenshot
                </button>
              ) : null}
            </div>
          </div>
          <button disabled={isPending} className="neutral-primary-button sat-save-mistake">
            Save mistake
          </button>
        </form>
      </section>
    </div>
  );
}
