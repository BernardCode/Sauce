"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addIcsSource } from "@/app/calendar/actions";

export function IcsSourceForm() {
  const [errors, setErrors] = useState<{
    schoology: string | null;
    other: string | null;
  }>({ schoology: null, other: null });
  const [isPending, startTransition] = useTransition();

  function submit(
    event: FormEvent<HTMLFormElement>,
    formKind: "schoology" | "other",
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setErrors((current) => ({ ...current, [formKind]: null }));
    startTransition(async () => {
      const result = await addIcsSource({
        label: String(form.get("label") ?? ""),
        url: String(form.get("url") ?? ""),
      });
      setErrors((current) => ({ ...current, [formKind]: result.error }));
      if (!result.error) formElement.reset();
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Schoology assignments</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
            FUHSD blocks Schoology API keys, so sauce uses your private Schoology
            calendar link. This connection is read-only.
          </p>
        </div>
        <a
          href="https://fuhsd.schoology.com/"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 dark:text-zinc-200 dark:decoration-zinc-700"
        >
          Open FUHSD Schoology
        </a>
      </div>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-zinc-500">
        <li>Open your name, then Settings.</li>
        <li>Find Share Your Schoology Calendar and enable it.</li>
        <li>Copy the iCal link and paste it below.</li>
      </ol>
      <form
        onSubmit={(event) => submit(event, "schoology")}
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
      >
        <input name="label" type="hidden" value="Schoology" />
        <input
          name="url"
          type="url"
          required
          placeholder="webcal://fuhsd.schoology.com/..."
          aria-label="Private Schoology iCal link"
          className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isPending ? "Connecting..." : "Connect Schoology"}
        </button>
        <p className="text-xs leading-5 text-zinc-500 sm:col-span-2">
          Treat this link like a password. sauce encrypts it before saving it.
          Assignments without a Schoology due date will not appear.
        </p>
        {errors.schoology ? (
          <p aria-live="polite" className="text-sm text-red-600 sm:col-span-2">
            {errors.schoology}
          </p>
        ) : null}
      </form>
      <details className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-300">
          Connect another calendar feed
        </summary>
        <form
          onSubmit={(event) => submit(event, "other")}
          className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto]"
        >
          <input
            name="label"
            required
            placeholder="Canvas"
            aria-label="Feed label"
            className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <input
            name="url"
            type="url"
            required
            placeholder="Private ICS URL"
            aria-label="Private ICS URL"
            className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add feed
          </button>
          {errors.other ? (
            <p aria-live="polite" className="text-sm text-red-600 sm:col-span-3">
              {errors.other}
            </p>
          ) : null}
        </form>
      </details>
    </div>
  );
}
