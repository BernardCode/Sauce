"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { classifyCourse } from "@/lib/quick-add/course";
import { parseDueText, parseQuickAdd } from "@/lib/quick-add/parse";
import { addItem } from "./actions";
import type { TodayItem } from "./task-types";

type DraftOption = "time" | "duration" | "due";

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

export function QuickAdd({
  onOptimisticAdd,
  todayDate,
  destination = "main",
}: {
  onOptimisticAdd: (item: TodayItem) => void;
  todayDate: string;
  destination?: "main" | "later";
}) {
  const isLater = destination === "later";
  const composerId = `today-${destination}-task-composer`;
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [value, setValue] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [duration, setDuration] = useState("");
  const [dueText, setDueText] = useState("");
  const [expandedOption, setExpandedOption] = useState<DraftOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (isComposing) titleInputRef.current?.focus();
  }, [isComposing]);

  function openComposer() {
    setMessage(null);
    setError(null);
    setIsComposing(true);
    titleInputRef.current?.focus();
  }

  function resetComposer() {
    setValue("");
    setScheduledTime("");
    setDuration("");
    setDueText("");
    setExpandedOption(null);
    setError(null);
    setIsComposing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    resetComposer();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = value.trim();
    if (trimmed === "") {
      setError("A task needs a title.");
      return;
    }

    const parsedQuickAdd = parseQuickAdd(trimmed);
    const parsedTitle = parsedQuickAdd.title || trimmed;
    const course = classifyCourse(parsedTitle);
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
    const estMinutes = explicitMinutes ?? parsedQuickAdd.estMinutes;
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
    const explicitDueAt = dueText === "" ? null : parseDueText(dueText);
    if (dueText !== "" && explicitDueAt === null) {
      setError("Use a date like Friday 11:59 pm, tomorrow 8:30, or the 24th.");
      return;
    }

    const dueAtIso = (explicitDueAt ?? parsedQuickAdd.dueAt)?.toISOString() ?? null;
    const isProject = parsedQuickAdd.isProject ?? false;
    const temporaryId = crypto.randomUUID();
    const submittedDraft = {
      value,
      scheduledTime,
      duration,
      dueText,
    };

    setError(null);
    setSavingCount((count) => count + 1);
    resetComposer();

    startTransition(async () => {
      onOptimisticAdd({
        id: temporaryId,
        title: parsedTitle,
        course,
        dueAt: dueAtIso,
        plannedDate: isProject || isLater ? null : todayDate,
        estMinutes,
        isProject,
        isLater: isLater && !isProject,
        origin: "manual",
        optimistic: true,
      });
      const result = await addItem({
        title: parsedTitle,
        dueAtIso,
        plannedDate: isLater ? null : todayDate,
        estMinutes,
        isProject,
        course,
        list: isProject ? "main" : destination,
        scheduledStartIso: isLater ? null : scheduledStartIso,
      });
      if (result.error) {
        setValue(submittedDraft.value);
        setScheduledTime(submittedDraft.scheduledTime);
        setDuration(submittedDraft.duration);
        setDueText(submittedDraft.dueText);
        setError(result.error);
        setIsComposing(true);
      } else {
        setMessage(result.warning ?? null);
      }
      setSavingCount((count) => Math.max(0, count - 1));
    });
  }

  const courseSuggestion = classifyCourse(parseQuickAdd(value).title);

  return (
    <>
      {isComposing ? (
        <li className="today-task-draft-row">
          <form
            id={composerId}
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            className="today-task-draft-form"
            aria-busy={savingCount > 0}
          >
            <div className="min-w-0">
              <input
                ref={titleInputRef}
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Task title"
                aria-label={isLater ? "Later task title" : "Task title"}
                className="today-task-draft-title"
                autoComplete="off"
                maxLength={500}
                required
              />
              {courseSuggestion ? (
                <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                  Course: {courseSuggestion}
                </p>
              ) : null}
              <div className="today-task-draft-option-buttons" aria-label="Optional task details">
                {!isLater ? (
                  <button
                    type="button"
                    aria-expanded={expandedOption === "time"}
                    onClick={() => setExpandedOption((current) => current === "time" ? null : "time")}
                    data-filled={scheduledTime !== ""}
                  >
                    {scheduledTime ? `Time ${scheduledTime}` : "Time"}
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-expanded={expandedOption === "duration"}
                  onClick={() => setExpandedOption((current) => current === "duration" ? null : "duration")}
                  data-filled={duration !== ""}
                >
                  {duration ? `${duration} min` : "Duration"}
                </button>
                <button
                  type="button"
                  aria-expanded={expandedOption === "due"}
                  onClick={() => setExpandedOption((current) => current === "due" ? null : "due")}
                  data-filled={dueText !== ""}
                >
                  {dueText ? `Due ${dueText}` : "Due date"}
                </button>
              </div>
              {expandedOption ? (
                <label className="today-task-draft-option">
                  <span>
                    {expandedOption === "time"
                      ? "Time"
                      : expandedOption === "duration"
                        ? "Duration in minutes"
                        : "Due date"}
                  </span>
                  {expandedOption === "time" ? (
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(event) => setScheduledTime(event.target.value)}
                    aria-label="Schedule time"
                    autoFocus
                  />
                  ) : expandedOption === "duration" ? (
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
                    autoFocus
                  />
                  ) : (
                  <input
                    type="text"
                    value={dueText}
                    onChange={(event) => setDueText(event.target.value)}
                    placeholder="Friday 11:59 pm"
                    aria-label="Due date"
                    autoComplete="off"
                    autoFocus
                  />
                  )}
                </label>
              ) : null}
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
      {!isComposing ? (
        <li className="today-task-add-row">
          <button
            type="button"
            onClick={openComposer}
            aria-label={isLater ? "Add a task for later" : "Start a new task"}
            aria-expanded="false"
            aria-controls={composerId}
            className="today-task-entry-input"
          >
            {isLater ? "Add for later" : "New task"}
          </button>
          {message ? (
            <p className="today-task-trigger-message" role="status">
              {message}
            </p>
          ) : null}
        </li>
      ) : null}
    </>
  );
}
