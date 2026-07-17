"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, RotateCcw, X } from "lucide-react";
import { deleteBlock, updateBlockTimes } from "./block-actions";

type MissedBlock = { id: string; title: string; startAt: string; endAt: string };

export function MissedWork({ initialBlocks }: { initialBlocks: MissedBlock[] }) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  if (!blocks.length) return null;

  function move(block: MissedBlock, tomorrow: boolean) {
    const previous = blocks;
    setBlocks((current) => current.filter((entry) => entry.id !== block.id));
    const duration = new Date(block.endAt).getTime() - new Date(block.startAt).getTime();
    const start = new Date();
    if (tomorrow) { start.setDate(start.getDate() + 1); start.setHours(16, 0, 0, 0); }
    else { start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15 + 15, 0, 0); }
    startTransition(async () => { const result = await updateBlockTimes({ id: block.id, startAtIso: start.toISOString(), endAtIso: new Date(start.getTime() + duration).toISOString() }); setError(result.error); if (result.error) setBlocks(previous); });
  }
  function remove(block: MissedBlock) { const previous = blocks; setBlocks((current) => current.filter((entry) => entry.id !== block.id)); startTransition(async () => { const result = await deleteBlock({ id: block.id }); setError(result.error); if (result.error) setBlocks(previous); }); }
  return (
    <section className="rounded-2xl border border-amber-200 bg-[var(--warning-soft)] p-4 dark:border-amber-900"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200"><RotateCcw size={15} />Recover missed work</h2><span className="text-xs text-amber-700 dark:text-amber-300">{blocks.length}</span></div><div className="mt-3 flex flex-col gap-2">{blocks.slice(0, 3).map((block) => <div key={block.id} className="rounded-xl bg-[var(--surface)] p-3"><p className="truncate text-sm font-semibold">{block.title}</p><div className="mt-2 flex flex-wrap gap-2"><button disabled={isPending} onClick={() => move(block, false)} className="inline-flex items-center gap-1 text-xs text-[var(--primary)]"><CalendarPlus size={12} />Later today</button><button disabled={isPending} onClick={() => move(block, true)} className="text-xs text-[var(--muted)]">Tomorrow</button><button disabled={isPending} onClick={() => remove(block)} className="ml-auto inline-flex items-center gap-1 text-xs text-rose-600"><X size={12} />Unschedule</button></div></div>)}</div>{error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}</section>
  );
}
