"use client";

import { useState, type ReactNode } from "react";

type Tab = "tasks" | "schedule" | "focus";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "schedule", label: "Schedule" },
  { id: "focus", label: "Focus" },
];

export function TodayWorkspace({
  tasks,
  schedule,
  focus,
}: {
  tasks: ReactNode;
  schedule: ReactNode;
  focus: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("tasks");

  return (
    <>
      <div className="motion-mobile-tabs mb-4 grid grid-cols-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-sm lg:hidden">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            data-active={tab === id}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === id
                ? "bg-[var(--primary-soft)] text-[var(--primary-deep)]"
                : "text-[var(--muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="today-grid">
        <section data-pane="schedule" className={tab === "schedule" ? "today-pane block" : "today-pane hidden lg:block"}>
          <div className="today-section-heading">
            <h2>Schedule</h2>
          </div>
          {schedule}
        </section>

        <section data-pane="tasks" className={tab === "tasks" ? "today-pane block" : "today-pane hidden lg:block"}>
          <div className="today-section-heading">
            <h2>Tasks</h2>
          </div>
          {tasks}
        </section>

        <aside data-pane="focus" className={tab === "focus" ? "today-pane block" : "today-pane hidden lg:block"}>
          <div className="today-section-heading">
            <h2>Focus</h2>
          </div>
          <div className="flex flex-col gap-4">{focus}</div>
        </aside>
      </div>
    </>
  );
}
