"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { BookOpenCheck, CalendarDays, CheckCircle2, FileText, LayoutDashboard, Link2, ListTodo, Plus, Search, Settings, Sparkles, Target, X } from "lucide-react";
import { addItem } from "@/app/today/actions";
import { parseQuickAdd } from "@/lib/quick-add/parse";

const destinations = [
  { href: "/today", label: "Today", description: "Daily briefing and schedule", icon: LayoutDashboard },
  { href: "/focus", label: "Do now", description: "Focus on the next useful action", icon: Target },
  { href: "/assignments", label: "Assignments", description: "Courses, deadlines, and progress", icon: ListTodo },
  { href: "/calendar", label: "Calendar", description: "Plan the week", icon: CalendarDays },
  { href: "/sat", label: "SAT studio", description: "Practice, mistakes, and score goals", icon: BookOpenCheck },
  { href: "/habits", label: "Habits", description: "Flexible weekly routines", icon: CheckCircle2 },
  { href: "/review", label: "Weekly review", description: "Reset and rescue next week", icon: Sparkles },
  { href: "/notes", label: "Notes", description: "Scratch notes and reference", icon: FileText },
  { href: "/links", label: "Links", description: "Saved school resources", icon: Link2 },
  { href: "/settings", label: "Settings", description: "Hours, sources, and planner rules", icon: Settings },
];

export function CommandMenu() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const matches = useMemo(() => destinations.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
      else if (event.key === "/" && !isTyping) { event.preventDefault(); setOpen(true); }
      else if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  function addQuickTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickAdd(query);
    if (!parsed.title) return;
    startTransition(async () => {
      const result = await addItem({ title: parsed.title, dueAtIso: parsed.dueAt?.toISOString() ?? null, estMinutes: parsed.estMinutes, isProject: parsed.isProject ?? false });
      setError(result.error);
      if (!result.error) { setOpen(false); setQuery(""); router.push("/assignments"); router.refresh(); }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hidden items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)] shadow-sm sm:inline-flex" aria-label="Open command menu"><Search size={14} />Find or add <kbd className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd></button>
      {open ? <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/35 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}><div role="dialog" aria-modal="true" aria-label="Command menu" className="motion-detail-panel w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <form onSubmit={addQuickTask} className="flex items-center gap-3 border-b border-[var(--line)] p-3"><Search size={18} className="text-[var(--muted)]" /><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setError(null); }} placeholder="Go somewhere or add an assignment" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /><button type="button" onClick={() => setOpen(false)} aria-label="Close command menu" className="rounded-lg p-1.5 text-[var(--muted)]"><X size={16} /></button></form>
        <div className="max-h-[60vh] overflow-y-auto p-2">{query.trim() ? <button type="submit" form="quick-command-form" disabled={isPending} className="hidden" /> : null}<form id="quick-command-form" onSubmit={addQuickTask}>{query.trim() ? <button disabled={isPending} className="mb-2 flex w-full items-center gap-3 rounded-xl bg-[var(--primary-soft)] p-3 text-left text-sm text-[var(--primary-deep)]"><span className="grid size-9 place-items-center rounded-lg bg-[var(--primary)] text-white"><Plus size={16} /></span><span className="min-w-0"><strong className="block truncate">Add “{query}”</strong><small className="text-[var(--muted)]">Natural dates and estimates work here</small></span></button> : null}</form><p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Jump to</p>{matches.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl p-3 hover:bg-[var(--surface-subtle)]"><span className="grid size-9 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"><Icon size={16} /></span><span><strong className="block text-sm">{label}</strong><small className="text-xs text-[var(--muted)]">{description}</small></span></Link>)}{error ? <p className="m-2 rounded-lg bg-[var(--danger-soft)] p-2 text-xs text-rose-600">{error}</p> : null}</div>
      </div></div> : null}
    </>
  );
}
