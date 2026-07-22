"use client";

import { useState, useTransition, type FormEvent } from "react";
import { habitContributionLevel } from "@/lib/habits/heatmap";
import {
  archiveHabit,
  createHabit,
  setHabitLog,
  updateHabit,
} from "./actions";

export type HabitGridRow = {
  id: string;
  name: string;
  cadence: string;
  days: number[];
  targetPerWeek: number;
  color: string;
  scheduledTime: string | null;
  completedDates: string[];
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cadenceLabel(habit: HabitGridRow): string {
  if (habit.cadence === "daily") return "Daily";
  if (habit.cadence === "weekdays") return "Weekdays";
  return habit.days.map((day) => dayLabels[day]).filter(Boolean).join(", ");
}

function HabitFormFields({ habit }: { habit?: HabitGridRow }) {
  return (
    <>
      <label>
        <span>Name</span>
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={habit?.name}
          placeholder={habit ? undefined : "Habit name"}
          autoFocus
        />
      </label>
      <label>
        <span>Cadence</span>
        <select name="cadence" defaultValue={habit?.cadence ?? "daily"}>
          <option value="daily">Daily</option>
          <option value="weekdays">Weekdays</option>
          <option value="custom">Specific days</option>
        </select>
      </label>
      <label>
        <span>Weekly target</span>
        <input
          name="target"
          type="number"
          min={1}
          max={7}
          defaultValue={habit?.targetPerWeek ?? 7}
        />
      </label>
      <label>
        <span>Time on schedule</span>
        <input
          name="scheduledTime"
          type="time"
          defaultValue={habit?.scheduledTime ?? ""}
        />
      </label>
      <label>
        <span>Color</span>
        <input
          name="color"
          type="color"
          defaultValue={habit?.color ?? "#37352f"}
        />
      </label>
      <fieldset>
        <legend>Specific days</legend>
        <div>
          {dayLabels.map((day, index) => (
            <label key={day}>
              <input
                type="checkbox"
                name="days"
                value={index}
                defaultChecked={habit?.days.includes(index)}
              />
              <span>{day}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function HabitGrid({
  rows,
  monthDates,
  todayDate,
}: {
  rows: HabitGridRow[];
  monthDates: string[];
  todayDate: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [completedByHabit, setCompletedByHabit] = useState<Record<string, string[]>>(
    () => Object.fromEntries(rows.map((habit) => [habit.id, habit.completedDates])),
  );
  const [isPending, startTransition] = useTransition();
  const completedCountByDate = new Map(
    monthDates.map((date) => [
      date,
      rows.reduce(
        (count, habit) =>
          count + ((completedByHabit[habit.id] ?? []).includes(date) ? 1 : 0),
        0,
      ),
    ]),
  );
  const busiestDay = Math.max(0, ...completedCountByDate.values());
  const monthStartOffset = monthDates[0]
    ? new Date(`${monthDates[0]}T12:00:00`).getDay()
    : 0;
  const monthLabel = new Date(`${todayDate}T12:00:00`).toLocaleDateString(
    undefined,
    { month: "long", year: "numeric" },
  );
  const selectedDateLabel =
    selectedDate === todayDate
      ? "Today"
      : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        });

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

  function edit(event: FormEvent<HTMLFormElement>, habit: HabitGridRow) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateHabit({
        id: habit.id,
        name: String(data.get("name") ?? ""),
        cadence: String(data.get("cadence")),
        days: data.getAll("days").map(Number),
        targetPerWeek: Number(data.get("target")),
        color: String(data.get("color") ?? ""),
        scheduledTime: String(data.get("scheduledTime") ?? "") || null,
      });
      setError(result.error);
      if (!result.error) setEditingHabitId(null);
    });
  }

  function archive(habitId: string) {
    startTransition(async () => {
      const result = await archiveHabit({ id: habitId });
      setError(result.error);
      if (!result.error && editingHabitId === habitId) {
        setEditingHabitId(null);
      }
    });
  }

  return (
    <div className="motion-habit-grid habit-workspace">
      <div className="habit-overview-grid">
        <section
          className="habit-today-section"
          aria-labelledby="habit-checklist-heading"
        >
          <h2 className="habit-period-heading" id="habit-checklist-heading">
            {selectedDateLabel}
          </h2>

          <div className="habit-today-list">
            {rows.map((habit) => {
              const doneOnSelectedDate = (
                completedByHabit[habit.id] ?? []
              ).includes(selectedDate);
              return (
                <div key={habit.id} className="habit-today-entry">
                  <article
                    className="habit-today-row"
                    data-done={doneOnSelectedDate}
                  >
                    <button
                      type="button"
                      aria-label={`Toggle ${habit.name} for ${selectedDateLabel.toLowerCase()}`}
                      aria-pressed={doneOnSelectedDate}
                      onClick={() => toggleDate(habit.id, selectedDate)}
                      className="habit-today-toggle"
                    >
                      <span className="habit-today-name">{habit.name}</span>
                    </button>
                    <details className="habit-options">
                      <summary aria-label={`Options for ${habit.name}`}>
                        <span aria-hidden="true">•••</span>
                      </summary>
                      <div className="habit-options-menu">
                        <button
                          type="button"
                          onClick={(event) => {
                            setEditingHabitId(habit.id);
                            event.currentTarget.closest("details")?.removeAttribute("open");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => archive(habit.id)}
                          className="habit-archive-option"
                        >
                          Archive
                        </button>
                      </div>
                    </details>
                  </article>
                  {editingHabitId === habit.id ? (
                    <form
                      onSubmit={(event) => edit(event, habit)}
                      className="habit-add-form habit-edit-form"
                    >
                      <div className="habit-add-form-heading">
                        <h2>Edit habit</h2>
                        <button type="button" onClick={() => setEditingHabitId(null)}>
                          Cancel
                        </button>
                      </div>
                      <HabitFormFields habit={habit} />
                      <button disabled={isPending} className="habit-create-button">
                        Save changes
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            })}
            {!rows.length ? <p className="habit-empty">No habits yet.</p> : null}
          </div>
        </section>

        <section className="habit-month-section" aria-labelledby="habit-month-heading">
          <h2 className="habit-period-heading" id="habit-month-heading">
            {monthLabel}
          </h2>
          <div
            className="habit-month-calendar"
            role="group"
            aria-label={`${monthLabel} habit completions`}
          >
            {Array.from({ length: monthStartOffset }, (_, index) => (
              <span key={`empty-${index}`} className="habit-month-empty" aria-hidden="true" />
            ))}
            {monthDates.map((date) => {
              const completed = completedCountByDate.get(date) ?? 0;
              const isFuture = date > todayDate;
              const isSelected = selectedDate === date;
              const level = isFuture
                ? 0
                : habitContributionLevel(completed, busiestDay);
              const label = new Date(`${date}T12:00:00`).toLocaleDateString(
                undefined,
                { month: "long", day: "numeric" },
              );
              return (
                <button
                  type="button"
                  key={date}
                  className="habit-month-day"
                  data-level={level}
                  data-today={date === todayDate}
                  data-future={isFuture}
                  data-selected={isSelected}
                  disabled={isFuture || !rows.length}
                  aria-pressed={!isFuture ? isSelected : undefined}
                  aria-label={`${label}, ${completed} of ${rows.length} habits completed${!isFuture && rows.length ? ", view this day" : ""}`}
                  title={`${label}: ${completed} of ${rows.length}`}
                  onClick={() => setSelectedDate(date)}
                />
              );
            })}
          </div>
          {rows.length ? (
            <div className="habit-month-stats" aria-label="Habit statistics">
              {rows.map((habit) => (
                <div key={habit.id}>
                  <strong>{habit.name}</strong>
                  <span>
                    {cadenceLabel(habit)}, {habit.currentStreak} day streak, {habit.longestStreak} best, {habit.completionRate}%
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="habit-add-area">
        {addOpen ? (
          <form onSubmit={add} className="habit-add-form">
            <div className="habit-add-form-heading">
              <h2>New habit</h2>
              <button type="button" onClick={() => setAddOpen(false)}>Close</button>
            </div>
            <HabitFormFields />
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
