"use client";

import { useState } from "react";

export function RebreakdownRequest({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);
  async function copyRequest() {
    await navigator.clipboard.writeText(
      `Re-break-down project ${projectId}. Load its current planning context, preserve manual or worked steps, then call decompose_project with the revised steps.`,
    );
    setCopied(true);
  }
  return (
    <button
      type="button"
      onClick={() => void copyRequest()}
      data-copied={copied}
      className="motion-rebreakdown rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
    >
      {copied ? "Request copied" : "Copy re-break-down request"}
    </button>
  );
}
