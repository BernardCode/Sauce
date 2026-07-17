"use client";

import { useState, useTransition } from "react";
import { createStarterBreakdown } from "./actions";

export function RebreakdownRequest({ projectId, canCreateStarter }: { projectId: string; canCreateStarter: boolean }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  async function copyRequest() {
    await navigator.clipboard.writeText(
      `Re-break-down project ${projectId}. Load its current planning context, preserve manual or worked steps, then call decompose_project with the revised steps.`,
    );
    setCopied(true);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
    {canCreateStarter ? <button type="button" disabled={isPending} onClick={() => startTransition(async () => { const result = await createStarterBreakdown({ projectId }); setMessage(result.error ?? "Starter steps created."); })} className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-white">Create starter steps</button> : null}
    <button
      type="button"
      onClick={() => void copyRequest()}
      data-copied={copied}
      className="motion-rebreakdown rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
    >
      {copied ? "Request copied" : "Copy re-break-down request"}
    </button>
    {message ? <span className="text-xs text-[var(--muted)]">{message}</span> : null}
    </div>
  );
}
