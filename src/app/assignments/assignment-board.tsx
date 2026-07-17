"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BatteryLow, BatteryMedium, BatteryFull, Check, Clock3, Filter, TimerReset, Upload } from "lucide-react";
import { setItemDone } from "@/app/today/actions";
import { QuickAdd } from "@/app/today/quick-add";
import { bulkAddAssignments, recordItemProgress, updateAssignment } from "./actions";

export type AssignmentRow = {
  id: string;
  title: string;
  course: string | null;
  dueAt: string | null;
  energy: "low" | "medium" | "high";
  priority: "low" | "normal" | "high";
  remainingMinutes: number | null;
  actualMinutes: number | null;
  isProject: boolean;
  scheduledAt: string | null;
};

const energyIcons = { low: BatteryLow, medium: BatteryMedium, high: BatteryFull };
const energyLabels = { low: "Light", medium: "Steady", high: "Deep focus" };

function dueLabel(value: string | null): { text: string; tone: string } {
  if (!value) return { text: "No deadline", tone: "text-[var(--muted)]" };
  const due = new Date(value);
  const hours = (due.getTime() - Date.now()) / 3_600_000;
  if (hours < 0) return { text: `Overdue ${due.toLocaleDateString()}`, tone: "text-rose-600" };
  if (hours < 24) return { text: `Due ${due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`, tone: "text-amber-600" };
  return { text: `Due ${due.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}`, tone: "text-[var(--muted)]" };
}

export function AssignmentBoard({ initialRows, initialFilter = "all" }: { initialRows: AssignmentRow[]; initialFilter?: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState(initialFilter);
  const [course, setCourse] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const courses = [...new Set(rows.map((row) => row.course).filter(Boolean) as string[])].sort();
  const visible = useMemo(() => rows.filter((row) => {
    if (course !== "all" && row.course !== course) return false;
    if (filter === "overdue") return Boolean(row.dueAt && new Date(row.dueAt) < new Date());
    if (filter === "unscheduled") return row.scheduledAt === null;
    if (filter === "projects") return row.isProject;
    return true;
  }), [course, filter, rows]);

  function save(row: AssignmentRow, patch: Partial<AssignmentRow>) {
    const next = { ...row, ...patch };
    setRows((current) => current.map((entry) => entry.id === row.id ? next : entry));
    setError(null);
    startTransition(async () => {
      const result = await updateAssignment({ id: next.id, course: next.course, energy: next.energy, priority: next.priority });
      setError(result.error);
      if (result.error) setRows((current) => current.map((entry) => entry.id === row.id ? row : entry));
    });
  }

  function logProgress(row: AssignmentRow, minutes: number) {
    const previous = rows;
    setRows((current) => current.map((entry) => entry.id === row.id ? {
      ...entry,
      actualMinutes: (entry.actualMinutes ?? 0) + minutes,
      remainingMinutes: Math.max(0, (entry.remainingMinutes ?? minutes) - minutes),
    } : entry));
    startTransition(async () => {
      const result = await recordItemProgress({ id: row.id, minutes });
      setError(result.error);
      if (result.error) setRows(previous);
    });
  }

  function complete(row: AssignmentRow) {
    const previous = rows;
    setRows((current) => current.filter((entry) => entry.id !== row.id));
    startTransition(async () => {
      const result = await setItemDone({ id: row.id });
      setError(result.error);
      if (result.error) setRows(previous);
    });
  }

  function bulkAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await bulkAddAssignments({ text: data.get("text"), course: String(data.get("course") ?? "").trim() || null });
      setError(result.error);
      if (!result.error) { form.reset(); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">Capture anything</p>
        <QuickAdd />
        <details className="motion-disclosure mt-3 border-t border-[var(--line)] pt-3"><summary className="cursor-pointer text-xs font-semibold text-[var(--muted)]">Bulk paste from Canvas or a syllabus</summary><form onSubmit={bulkAdd} className="mt-3 grid gap-2 sm:grid-cols-[1fr_10rem]"><textarea name="text" required placeholder={'One assignment per line\nChem quiz fri 30m\n* History essay 8/24 3h'} className="min-h-28 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm sm:row-span-2" /><input name="course" placeholder="Course for all" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm" /><button disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"><Upload size={15} />Import</button></form></details>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={15} className="text-[var(--muted)]" />
        {[["all", "All"], ["overdue", "Overdue"], ["unscheduled", "Unscheduled"], ["projects", "Projects"]].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} data-active={filter === value} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] data-[active=true]:border-[var(--primary)] data-[active=true]:bg-[var(--primary-soft)] data-[active=true]:text-[var(--primary-deep)]">{label}</button>
        ))}
        <select value={course} onChange={(event) => setCourse(event.target.value)} className="ml-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs">
          <option value="all">Every course</option>
          {courses.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      {error ? <p className="rounded-xl bg-[var(--danger-soft)] p-3 text-sm text-rose-600">{error}</p> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {visible.map((row) => {
          const due = dueLabel(row.dueAt);
          const EnergyIcon = energyIcons[row.energy];
          return (
            <article key={row.id} className="group rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-[var(--surface)] hover:shadow-lg dark:hover:border-indigo-800">
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => complete(row)} disabled={isPending || row.isProject} aria-label={`Complete ${row.title}`} className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border border-[var(--line)] text-transparent hover:border-emerald-400 hover:text-emerald-500 disabled:cursor-not-allowed"><Check size={14} /></button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">{row.isProject ? <Link href={`/projects/${row.id}`} className="font-semibold hover:text-[var(--primary)]">{row.title}</Link> : <h2 className="font-semibold">{row.title}</h2>}{row.isProject ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">Project</span> : null}</div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs"><span className={due.tone}>{due.text}</span><span className="text-[var(--muted)]">{row.remainingMinutes ?? "?"}m left</span>{row.scheduledAt ? <span className="text-sky-600">Scheduled {new Date(row.scheduledAt).toLocaleDateString([], { weekday: "short" })}</span> : <span className="text-amber-600">Needs time</span>}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
                <input value={row.course ?? ""} onChange={(event) => setRows((current) => current.map((entry) => entry.id === row.id ? { ...entry, course: event.target.value } : entry))} onBlur={(event) => save(row, { course: event.target.value.trim() || null })} placeholder="Course" aria-label={`Course for ${row.title}`} className="w-28 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs" />
                <button type="button" onClick={() => save(row, { energy: row.energy === "low" ? "medium" : row.energy === "medium" ? "high" : "low" })} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--muted)]"><EnergyIcon size={14} />{energyLabels[row.energy]}</button>
                {!row.isProject ? <><button type="button" onClick={() => logProgress(row, 15)} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--primary-soft)]"><Clock3 size={13} />+15m</button><button type="button" onClick={() => logProgress(row, 30)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--primary-soft)]"><TimerReset size={13} />+30m</button></> : null}
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length ? <div className="rounded-2xl border border-dashed border-[var(--line)] p-10 text-center text-sm text-[var(--muted)]">Nothing matches this view.</div> : null}
    </div>
  );
}
