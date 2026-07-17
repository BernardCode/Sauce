"use client";

import { useState, useTransition, type DragEvent, type FormEvent } from "react";
import { addLink, deleteLink, reorderLinks } from "./actions";

export type SavedLink = {
  id: string;
  title: string;
  url: string;
  tag: string;
  faviconUrl: string | null;
};

export function LinkGrid({ initialLinks }: { initialLinks: SavedLink[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const tags = [...new Set(links.map((link) => link.tag))];

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    startTransition(async () => {
      const result = await addLink({ url: String(form.get("url") ?? ""), tag: String(form.get("tag") ?? "") });
      setError(result.error);
      if (!result.error) formElement.reset();
    });
  }

  function drop(event: DragEvent<HTMLElement>, target: SavedLink) {
    event.preventDefault();
    const dragged = links.find((link) => link.id === draggedId);
    if (!dragged || dragged.id === target.id || dragged.tag !== target.tag) return;
    const next = [...links];
    const from = next.findIndex((link) => link.id === dragged.id);
    const to = next.findIndex((link) => link.id === target.id);
    next.splice(from, 1);
    next.splice(to, 0, dragged);
    setLinks(next);
    setDraggedId(null);
    startTransition(async () => {
      const result = await reorderLinks({
        tag: target.tag,
        orderedIds: next.filter((link) => link.tag === target.tag).map((link) => link.id),
      });
      if (result.error) setLinks(initialLinks);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
        <input name="url" type="url" required placeholder="https://example.com" className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
        <input name="tag" required placeholder="Tag" className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
        <button disabled={isPending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">Add link</button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {tags.map((tag) => (
        <section key={tag}>
          <h2 className="font-medium">{tag}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.filter((link) => link.tag === tag).map((link) => (
              <article
                key={link.id}
                draggable={!isPending}
                onDragStart={() => setDraggedId(link.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => drop(event, link)}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                {link.faviconUrl ? (
                  <span
                    aria-hidden="true"
                    className="size-5 bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: `url("${link.faviconUrl}")` }}
                  />
                ) : null}
                <a href={link.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium">{link.title}</h3>
                  <p className="truncate text-xs text-zinc-500">{new URL(link.url).hostname}</p>
                </a>
                <button
                  type="button"
                  onClick={() => startTransition(async () => setError((await deleteLink({ id: link.id })).error))}
                  className="text-xs text-red-600"
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}
      {!links.length ? <p className="text-sm text-zinc-500">No saved links yet.</p> : null}
    </div>
  );
}
