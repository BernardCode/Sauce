"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock3, RotateCcw } from "lucide-react";
import { recordBlockWork } from "@/app/today/block-actions";
import { setItemDone } from "@/app/today/actions";
import { DoNowCounter } from "@/app/today/do-now-counter";

export function FocusSession({ blockId, itemId }: { blockId: string; itemId: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function log(minutes: number) {
    startTransition(async () => {
      const result = await recordBlockWork({ id: blockId, minutes });
      setMessage(result.error ?? `${minutes} minutes recorded.`);
    });
  }
  function complete() {
    if (!itemId) return;
    startTransition(async () => {
      const result = await setItemDone({ id: itemId });
      setMessage(result.error ?? "Finished. Your plan is updated.");
    });
  }
  return (
    <div className="flex flex-col gap-4">
      <DoNowCounter blockId={blockId} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isPending} onClick={() => log(15)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"><Clock3 size={15} />Worked 15m</button>
        <button type="button" disabled={isPending} onClick={() => log(30)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"><RotateCcw size={15} />Need another session</button>
        {itemId ? <button type="button" disabled={isPending} onClick={complete} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white"><CheckCircle2 size={15} />Finished</button> : null}
      </div>
      {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
