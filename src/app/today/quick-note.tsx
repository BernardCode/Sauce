"use client";

import { useEffect, useRef, useState } from "react";
import { ensureDailyNote, saveDailyNote } from "@/app/notes/actions";

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
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-medium">Quick note</h2>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add to today's note"
        aria-label="Quick note"
        className="mt-2 min-h-28 w-full resize-y rounded border border-zinc-200 bg-transparent p-2 text-sm outline-none dark:border-zinc-700"
      />
      <p className="h-4 text-xs text-zinc-500">{status}</p>
    </section>
  );
}
