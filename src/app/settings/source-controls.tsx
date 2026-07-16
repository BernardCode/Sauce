"use client";

import { useState, useTransition } from "react";
import { setSourceEnabled, syncSource } from "@/app/calendar/actions";

type Props = {
  id: string;
  enabled: boolean;
};

export function SourceControls({ id, enabled }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => run(() => syncSource({ id }))}
          disabled={isPending || !enabled}
          className="text-sm text-zinc-500 disabled:opacity-40"
        >
          Sync now
        </button>
        <button
          type="button"
          onClick={() => run(() => setSourceEnabled({ id, enabled: !enabled }))}
          disabled={isPending}
          className="text-sm text-zinc-500 disabled:opacity-40"
        >
          {enabled ? "Disable" : "Enable"}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
