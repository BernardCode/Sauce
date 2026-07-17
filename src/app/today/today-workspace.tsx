"use client";

import { useState, type ReactNode } from "react";
import { CalendarClock, ListTodo, Sparkles } from "lucide-react";

type Tab = "tasks" | "schedule" | "focus";

const tabs: Array<{ id: Tab; label: string; icon: typeof ListTodo }> = [
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "focus", label: "Focus", icon: Sparkles },
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
        {tabs.map(({ id, label, icon: Icon }) => (
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
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="today-grid">
        <section data-pane="schedule" className={tab === "schedule" ? "today-pane block" : "today-pane hidden lg:block"}>
          <div className="today-section-heading">
            <div>
              <span>Timeline</span>
              <h2>Today&apos;s schedule</h2>
            </div>
            <CalendarClock size={18} />
          </div>
          {schedule}
        </section>

        <section data-pane="tasks" className={tab === "tasks" ? "today-pane block" : "today-pane hidden lg:block"}>
          <div className="today-section-heading">
            <div>
              <span>Plan</span>
              <h2>Tasks and projects</h2>
            </div>
            <ListTodo size={18} />
          </div>
          {tasks}
        </section>

        <aside data-pane="focus" className={tab === "focus" ? "today-pane block" : "today-pane hidden lg:block"}>
          <div className="today-section-heading">
            <div>
              <span>Momentum</span>
              <h2>Focus and progress</h2>
            </div>
            <Sparkles size={18} />
          </div>
          <div className="flex flex-col gap-4">{focus}</div>
        </aside>
      </div>
    </>
  );
}
