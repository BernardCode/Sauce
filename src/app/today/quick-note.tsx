"use client";

import { useEffect, useRef, useState } from "react";
import { ensureDailyNote, saveDailyNote } from "@/app/notes/actions";
import { NotebookPen } from "lucide-react";

export function QuickNote({ date, initialBody }: { date: string; initialBody: string }) {
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<string | null>(null);
  const firstSave = useRef(true);

  useEffect(() => {
    void ensureDailyNote({ date }).then((result) => setStatus(result.error));
  }, [date]);

  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    setStatus("Saving");
    const timer = window.setTimeout(() => {
      void saveDailyNote({ date, body }).then((result) =>
        setStatus(result.error ?? "Saved"),
      );
    }, 600);
    return () => window.clearTimeout(timer);
  }, [body, date]);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
      <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Quick note</h2><NotebookPen size={17} className="text-violet-500" /></div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add to today's note"
        aria-label="Quick note"
        className="mt-3 min-h-28 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 dark:focus:ring-violet-950"
      />
      <p className="h-4 text-xs text-zinc-500">{status}</p>
    </section>
  );
}
