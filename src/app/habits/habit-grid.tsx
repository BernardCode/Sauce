"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  archiveHabit,
  createHabit,
  setHabitLog,
  setHabitScheduleTime,
} from "./actions";

export type HabitGridRow = {
  id: string;
  name: string;
  cadence: string;
  days: number[];
  scheduledTime: string | null;
  todayDue: boolean;
  completedDates: string[];
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
};

function cadenceLabel(habit: HabitGridRow): string {
  if (habit.cadence === "daily") return "Daily";
  if (habit.cadence === "weekdays") return "Weekdays";
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return habit.days.map((day) => dayLabels[day]).filter(Boolean).join(", ");
}

export function HabitGrid({
  rows,
  dates,
  todayDate,
}: {
  rows: HabitGridRow[];
  dates: string[];
  todayDate: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [completedByHabit, setCompletedByHabit] = useState<Record<string, string[]>>(
    () => Object.fromEntries(rows.map((habit) => [habit.id, habit.completedDates])),
  );
  const [scheduleByHabit, setScheduleByHabit] = useState<Record<string, string | null>>(
    () => Object.fromEntries(rows.map((habit) => [habit.id, habit.scheduledTime])),
  );
  const [isPending, startTransition] = useTransition();
  const historyDates = dates.filter((date) => date !== todayDate);

  function toggleDate(habitId: string, date: string) {
    const wasDone = (completedByHabit[habitId] ?? []).includes(date);
    const nextDone = !wasDone;
    setCompletedByHabit((current) => {
      const values = new Set(current[habitId] ?? []);
      if (nextDone) values.add(date);
      else values.delete(date);
      return { ...current, [habitId]: [...values] };
    });
    startTransition(async () => {
      const result = await setHabitLog({ habitId, date, done: nextDone });
      setError(result.error);
      if (result.error) {
        setCompletedByHabit((current) => {
          const values = new Set(current[habitId] ?? []);
          if (wasDone) values.add(date);
          else values.delete(date);
          return { ...current, [habitId]: [...values] };
        });
      }
    });
  }

  function updateTime(habitId: string, value: string) {
    const scheduledTime = value || null;
    const previous = scheduleByHabit[habitId] ?? null;
    setScheduleByHabit((current) => ({ ...current, [habitId]: scheduledTime }));
    startTransition(async () => {
      const result = await setHabitScheduleTime({ id: habitId, scheduledTime });
      setError(result.error);
      if (result.error) {
        setScheduleByHabit((current) => ({ ...current, [habitId]: previous }));
      }
    });
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    startTransition(async () => {
      const result = await createHabit({
        name: String(data.get("name") ?? ""),
        cadence: String(data.get("cadence")),
        days: data.getAll("days").map(Number),
        targetPerWeek: Number(data.get("target")),
        color: String(data.get("color") ?? ""),
        scheduledTime: String(data.get("scheduledTime") ?? "") || null,
      });
      setError(result.error);
      if (!result.error) {
        formElement.reset();
        setAddOpen(false);
      }
    });
  }

  return (
    <div className="motion-habit-grid habit-workspace">
      <section className="neutral-panel habit-today-section" aria-labelledby="habit-today-heading">
        <header className="neutral-panel-header habit-section-heading">
          <div className="neutral-panel-heading">
            <span className="neutral-panel-label" id="habit-today-heading">Today</span>
            <span className="neutral-panel-count">{rows.filter((habit) => (completedByHabit[habit.id] ?? []).includes(todayDate)).length}/{rows.length}</span>
          </div>
          <span className="neutral-panel-note">{new Date(`${todayDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
        </header>

        <div className="habit-today-list">
          {rows.map((habit) => {
            const doneToday = (completedByHabit[habit.id] ?? []).includes(todayDate);
            const scheduledTime = habit.id in scheduleByHabit
              ? (scheduleByHabit[habit.id] ?? "")
              : (habit.scheduledTime ?? "");
            return (
              <article key={habit.id} className="habit-today-row" data-done={doneToday}>
                <button
                  type="button"
                  aria-label={`Mark ${habit.name} ${doneToday ? "not done" : "done"} for today`}
                  aria-pressed={doneToday}
                  onClick={() => toggleDate(habit.id, todayDate)}
                  className="habit-today-check"
                >
                  <span aria-hidden="true">{doneToday ? "✓" : ""}</span>
                </button>
                <div className="habit-today-copy">
                  <h3>{habit.name}</h3>
                  <p>{habit.todayDue ? cadenceLabel(habit) : `${cadenceLabel(habit)}, optional today`}</p>
                </div>
                <label className="habit-time-control">
                  <span>Time</span>
                  <input
                    type="time"
                    value={scheduledTime}
                    aria-label={`Schedule time for ${habit.name}`}
                    onChange={(event) => updateTime(habit.id, event.target.value)}
                  />
                </label>
                <div className="habit-row-actions">
                  {scheduledTime ? <span>On calendar</span> : <span>Not on schedule</span>}
                  <button
                    type="button"
                    onClick={() => startTransition(async () => setError((await archiveHabit({ id: habit.id })).error))}
                  >
                    Archive
                  </button>
                </div>
              </article>
            );
          })}
          {!rows.length ? <p className="habit-empty">No habits yet.</p> : null}
        </div>
      </section>

      {rows.length ? (
        <details className="neutral-panel habit-history" open>
          <summary>Previous 29 days</summary>
          <div className="habit-history-scroll">
            <div className="habit-history-grid">
              <span />
              {historyDates.map((date) => <span key={date}>{date.slice(8)}</span>)}
              {rows.map((habit) => {
                const completed = new Set(completedByHabit[habit.id] ?? []);
                return (
                  <div key={habit.id} className="contents">
                    <div className="habit-history-name">
                      <span>{habit.name}</span>
                      <small>{habit.currentStreak} day streak, {habit.longestStreak} best, {habit.completionRate}%</small>
                    </div>
                    {historyDates.map((date) => {
                      const done = completed.has(date);
                      return (
                        <button
                          key={date}
                          type="button"
                          aria-label={`${habit.name}, ${date}, ${done ? "done" : "not done"}`}
                          data-done={done}
                          onClick={() => toggleDate(habit.id, date)}
                          className="motion-habit-cell habit-history-cell"
                          title={`${habit.name}, ${date}`}
                        >
                          <span className="sr-only">{done ? "Done" : "Not done"}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      ) : null}

      <div className="habit-add-area">
        {addOpen ? (
          <form onSubmit={add} className="habit-add-form">
            <div className="habit-add-form-heading">
              <h2>New habit</h2>
              <button type="button" onClick={() => setAddOpen(false)}>Close</button>
            </div>
            <label>
              <span>Name</span>
              <input name="name" required placeholder="Habit name" autoFocus />
            </label>
            <label>
              <span>Cadence</span>
              <select name="cadence">
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="custom">Specific days</option>
              </select>
            </label>
            <label>
              <span>Weekly target</span>
              <input name="target" type="number" min={1} max={7} defaultValue={7} />
            </label>
            <label>
              <span>Time on schedule</span>
              <input name="scheduledTime" type="time" />
            </label>
            <label>
              <span>Color</span>
              <input name="color" type="color" defaultValue="#37352f" />
            </label>
            <fieldset>
              <legend>Specific days</legend>
              <div>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                  <label key={day}>
                    <input type="checkbox" name="days" value={index} />
                    <span>{day}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button disabled={isPending} className="habit-create-button">Create habit</button>
          </form>
        ) : null}
        {error ? <p className="habit-error" role="alert">{error}</p> : null}
        <button
          type="button"
          aria-expanded={addOpen}
          onClick={() => setAddOpen((current) => !current)}
          className="habit-add-trigger"
        >
          {addOpen ? "Hide" : "+ Add habit"}
        </button>
      </div>
    </div>
  );
}
