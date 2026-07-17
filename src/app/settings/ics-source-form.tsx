"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addIcsSource } from "@/app/calendar/actions";

export function IcsSourceForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    startTransition(async () => {
      const result = await addIcsSource({
        label: String(form.get("label") ?? ""),
        url: String(form.get("url") ?? ""),
      });
      setError(result.error);
      if (!result.error) formElement.reset();
    });
  }
  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
      <input name="label" required placeholder="Canvas" className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
      <input name="url" type="url" required placeholder="Secret ICS URL" className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
      <button disabled={isPending} className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">Add ICS feed</button>
      {error ? <p className="text-sm text-red-600 sm:col-span-3">{error}</p> : null}
    </form>
  );
}
