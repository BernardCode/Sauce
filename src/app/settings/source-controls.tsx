"use client";

import { useState, useTransition } from "react";
import { deleteSource, setSourceEnabled, syncSource } from "@/app/calendar/actions";

type Props = {
  id: string;
  enabled: boolean;
  canSync: boolean;
};

export function SourceControls({ id, enabled, canSync }: Props) {
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
    <div className="motion-source-controls flex flex-col items-end gap-1" data-pending={isPending}>
      <div className="flex gap-3">
        {canSync ? (
          <>
            <button
              type="button"
              onClick={() => run(() => syncSource({ id }))}
              disabled={isPending || !enabled}
              className="motion-sync text-sm text-zinc-500 disabled:opacity-40"
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
          </>
        ) : null}
        <button
          type="button"
          onClick={() => run(() => deleteSource({ id }))}
          disabled={isPending}
          className="text-sm text-red-600 disabled:opacity-40"
        >
          Remove
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
