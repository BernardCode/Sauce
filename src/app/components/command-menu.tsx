"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { addItem } from "@/app/today/actions";
import { parseQuickAdd } from "@/lib/quick-add/parse";
import { OPEN_COMMAND_MENU_EVENT } from "@/app/components/ui-events";

const destinations = [
  { href: "/today", label: "Today" },
  { href: "/focus", label: "Do now" },
  { href: "/assignments", label: "Assignments" },
  { href: "/calendar", label: "Calendar" },
  { href: "/sat", label: "SAT studio" },
  { href: "/habits", label: "Habits" },
  { href: "/review", label: "Weekly review" },
  { href: "/notes", label: "Notes" },
  { href: "/links", label: "Links" },
  { href: "/settings", label: "Settings" },
];

export function CommandMenu() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const matches = useMemo(() => destinations.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query]);

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

  useEffect(() => {
    function onOpenCommandMenu() {
      setError(null);
      setQuery("");
      setOpen(true);
    }
    window.addEventListener(OPEN_COMMAND_MENU_EVENT, onOpenCommandMenu);
    return () => window.removeEventListener(OPEN_COMMAND_MENU_EVENT, onOpenCommandMenu);
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
      <button type="button" onClick={() => setOpen(true)} className="app-command-button" aria-label="Find anything"><span>Find</span><kbd className="hidden font-mono text-[10px] sm:inline">⌘K</kbd></button>
      {open ? <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 p-4 pt-[10vh]" onMouseDown={() => setOpen(false)}><div role="dialog" aria-modal="true" aria-label="Command menu" className="motion-detail-panel w-full max-w-xl overflow-hidden border border-[var(--line-strong)] bg-[var(--surface)] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <form onSubmit={addQuickTask} className="flex items-center gap-3 border-b border-[var(--line)] p-3"><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setError(null); }} placeholder="Find a page or add a task" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /><button type="button" onClick={() => setOpen(false)} aria-label="Close command menu" className="px-2 py-1 text-xs font-semibold text-[var(--muted)]">Close</button></form>
        <div className="max-h-[60vh] overflow-y-auto p-2">{query.trim() ? <button type="submit" form="quick-command-form" disabled={isPending} className="hidden" /> : null}<form id="quick-command-form" onSubmit={addQuickTask}>{query.trim() ? <button disabled={isPending} className="mb-2 w-full border-l-4 border-[var(--task-accent)] bg-[var(--task-soft)] p-3 text-left text-sm text-[var(--task-ink)]"><strong className="block truncate">Add “{query}”</strong></button> : null}</form><p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Pages</p>{matches.map(({ href, label }) => <Link key={href} href={href} onClick={() => setOpen(false)} className="block border-t border-[var(--line)] px-3 py-2.5 first:border-0 hover:bg-[var(--surface-subtle)]"><strong className="text-sm">{label}</strong></Link>)}{error ? <p className="m-2 bg-[var(--danger-soft)] p-2 text-xs text-rose-600">{error}</p> : null}</div>
      </div></div> : null}
    </>
  );
}
