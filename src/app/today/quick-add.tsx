"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import { addItem } from "./actions";

function todayAtTime(value: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const start = new Date();
  start.setHours(hours, minutes, 0, 0);
  return start.toISOString();
}

function endOfDueDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const due = new Date(year, month - 1, day, 23, 59, 0, 0);
  if (
    due.getFullYear() !== year ||
    due.getMonth() !== month - 1 ||
    due.getDate() !== day
  ) {
    return null;
  }
  return due.toISOString();
}

export function QuickAdd({
  onPendingChange,
}: {
  onPendingChange?: (title: string | null) => void;
}) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [value, setValue] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [duration, setDuration] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isComposing) titleInputRef.current?.focus();
  }, [isComposing]);

  function openComposer() {
    if (isPending) return;
    setMessage(null);
    setError(null);
    setIsComposing(true);
    titleInputRef.current?.focus();
  }

  function resetComposer() {
    setValue("");
    setScheduledTime("");
    setDuration("");
    setDueDate("");
    setError(null);
    setIsComposing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape" || isPending) return;
    event.preventDefault();
    resetComposer();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const trimmed = value.trim();
    if (trimmed === "") {
      setError("A task needs a title.");
      return;
    }

    // Parsing happens here, not in the action, because only the browser
    // knows the user's timezone.
    const parsed = parseQuickAdd(trimmed);
    const explicitMinutes = duration === "" ? null : Number(duration);
    if (
      explicitMinutes !== null &&
      (!Number.isInteger(explicitMinutes) ||
        explicitMinutes < 1 ||
        explicitMinutes > 600)
    ) {
      setError("Duration must be between 1 and 600 minutes.");
      return;
    }
    const estMinutes = explicitMinutes ?? parsed.estMinutes;
    const scheduledStartIso =
      scheduledTime === "" ? null : todayAtTime(scheduledTime);
    if (scheduledTime !== "" && scheduledStartIso === null) {
      setError("Choose a valid time.");
      return;
    }
    if (scheduledStartIso && estMinutes === null) {
      setError("Add a duration before scheduling this task.");
      return;
    }
    const explicitDueAtIso = dueDate === "" ? null : endOfDueDate(dueDate);
    if (dueDate !== "" && explicitDueAtIso === null) {
      setError("Choose a valid due date.");
      return;
    }

    setError(null);
    setIsComposing(false);
    onPendingChange?.(parsed.title);

    startTransition(async () => {
      const result = await addItem({
        title: parsed.title,
        dueAtIso:
          explicitDueAtIso ??
          (parsed.dueAt ? parsed.dueAt.toISOString() : null),
        estMinutes,
        isProject: parsed.isProject === true,
        scheduledStartIso,
      });
      if (result.error) {
        setError(result.error);
        setIsComposing(true);
      } else {
        resetComposer();
        setMessage(result.warning ?? null);
      }
      onPendingChange?.(null);
    });
  }

  return (
    <>
      {isComposing ? (
        <li className="today-task-draft-row">
          <form
            id="today-task-composer"
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            className="today-task-draft-form"
            aria-busy={isPending}
          >
            <span className="today-task-draft-checkbox" aria-hidden="true" />
            <div className="min-w-0">
              <input
                ref={titleInputRef}
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Task title"
                aria-label="Task title"
                className="today-task-draft-title"
                autoComplete="off"
              />
              <div className="today-task-draft-options">
                <label className="today-task-draft-option">
                  <span>Time</span>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(event) => setScheduledTime(event.target.value)}
                    aria-label="Schedule time"
                  />
                </label>
                <label className="today-task-draft-option">
                  <span>Duration</span>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    step={5}
                    inputMode="numeric"
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                    placeholder="Minutes"
                    aria-label="Duration in minutes"
                  />
                </label>
                <label className="today-task-draft-option">
                  <span>Due</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    aria-label="Due date"
                  />
                </label>
              </div>
              {error ? (
                <p className="today-task-entry-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="sr-only" tabIndex={-1}>
                Save task
              </button>
            </div>
          </form>
        </li>
      ) : null}
      <li className="today-task-add-row">
        <button
          type="button"
          disabled={isPending}
          onClick={openComposer}
          aria-label="Start a new task"
          aria-expanded={isComposing}
          aria-controls="today-task-composer"
          className="today-task-entry-input"
        >
          New task
        </button>
        {message ? (
          <p className="today-task-trigger-message" role="status">
            {message}
          </p>
        ) : null}
      </li>
    </>
  );
}
