"use client";

import { useState, useTransition } from "react";
import { updatePlannerSettings } from "./actions";

type BlockedWindow = {
  days?: number[];
  start: string;
  end: string;
};

type Props = {
  initialTimezone: string;
  initialWake: number;
  initialSleep: number;
  initialWindows: BlockedWindow[];
  initialPreferences: string;
};

const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

export function PlannerSettingsForm({
  initialTimezone,
  initialWake,
  initialSleep,
  initialWindows,
  initialPreferences,
}: Props) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const [wake, setWake] = useState(initialWake);
  const [sleep, setSleep] = useState(initialSleep);
  const [windows, setWindows] = useState(initialWindows);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateWindow(index: number, next: BlockedWindow) {
    setWindows((current) =>
      current.map((window, windowIndex) =>
        windowIndex === index ? next : window,
      ),
    );
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updatePlannerSettings({
        timezone,
        workingHours: { wake, sleep, blockedWindows: windows },
        plannerPreferences: preferences,
      });
      setMessage(result.error ?? "Saved.");
    });
  }

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h2 className="font-medium">Planner</h2>
        <p className="mt-1 text-sm text-zinc-500">
          The planner only places work inside these hours and outside blocked windows.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Time zone
        <input
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          list="timezones"
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        <datalist id="timezones">
          <option value="America/Los_Angeles" />
          <option value="America/Denver" />
          <option value="America/Chicago" />
          <option value="America/New_York" />
          <option value="UTC" />
        </datalist>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Wake hour
          <input
            type="number"
            min={0}
            max={23}
            value={wake}
            onChange={(event) => setWake(Number(event.target.value))}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Sleep hour
          <input
            type="number"
            min={1}
            max={24}
            value={sleep}
            onChange={(event) => setSleep(Number(event.target.value))}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Blocked windows</h3>
          <button
            type="button"
            onClick={() =>
              setWindows((current) => [
                ...current,
                { days: [1, 2, 3, 4, 5], start: "08:00", end: "15:00" },
              ])
            }
            className="text-sm text-zinc-500"
          >
            Add window
          </button>
        </div>
        {windows.map((window, index) => (
          <div
            key={index}
            className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={window.start}
                aria-label={`Blocked window ${index + 1} start`}
                onChange={(event) =>
                  updateWindow(index, { ...window, start: event.target.value })
                }
                className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
              />
              <span className="text-sm text-zinc-500">to</span>
              <input
                type="time"
                value={window.end}
                aria-label={`Blocked window ${index + 1} end`}
                onChange={(event) =>
                  updateWindow(index, { ...window, end: event.target.value })
                }
                className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
              />
              <button
                type="button"
                onClick={() =>
                  setWindows((current) =>
                    current.filter((_, windowIndex) => windowIndex !== index),
                  )
                }
                className="ml-auto text-sm text-red-600"
              >
                Remove
              </button>
            </div>
            <div className="mt-2 flex gap-1" aria-label="Days for blocked window">
              {dayLabels.map((label, day) => {
                const selected = window.days?.includes(day) ?? true;
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${label} day ${day + 1}`}
                    onClick={() => {
                      const days = window.days ?? [0, 1, 2, 3, 4, 5, 6];
                      updateWindow(index, {
                        ...window,
                        days: selected
                          ? days.filter((value) => value !== day)
                          : [...days, day].sort(),
                      });
                    }}
                    className={`size-7 rounded-full text-xs ${
                      selected
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Planner preferences
        <textarea
          value={preferences}
          onChange={(event) => setPreferences(event.target.value)}
          rows={4}
          placeholder="Front-load hard work before dinner. Leave Friday evening empty."
          className="resize-y rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Save planner settings
        </button>
        {message ? (
          <p className={`text-sm ${message === "Saved." ? "text-zinc-500" : "text-red-600"}`}>
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
