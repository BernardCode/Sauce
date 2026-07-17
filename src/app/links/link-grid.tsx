"use client";

import { useState, useTransition, type DragEvent, type FormEvent } from "react";
import { ExternalLink, GripVertical, Plus, Trash2 } from "lucide-react";
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

  function remove(link: SavedLink) {
    const previous = links;
    setLinks((current) => current.filter((entry) => entry.id !== link.id));
    startTransition(async () => {
      const result = await deleteLink({ id: link.id });
      setError(result.error);
      if (result.error) setLinks(previous);
    });
  }

  return (
    <div className="motion-link-grid flex flex-col gap-8">
      <form onSubmit={add} className="grid gap-2 rounded-xl bg-[var(--surface-subtle)] p-3 sm:grid-cols-[1fr_12rem_auto]">
        <input name="url" type="url" required placeholder="https://example.com" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" />
        <input name="tag" required placeholder="Tag" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" />
        <button disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-deep)]"><Plus size={16} /> Add link</button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {tags.map((tag) => (
        <section key={tag} className="motion-link-group">
          <h2 className="motion-link-heading flex items-center gap-2 font-semibold"><span className="size-2 rounded-full bg-[var(--primary)]" />{tag}<span className="text-xs font-normal text-[var(--muted)]">{links.filter((link) => link.tag === tag).length}</span></h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.filter((link) => link.tag === tag).map((link) => (
              <article
                key={link.id}
                draggable={!isPending}
                onDragStart={() => setDraggedId(link.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => drop(event, link)}
                className="motion-link-card group flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3.5 hover:border-[var(--task-accent)] hover:bg-[var(--surface)]"
              >
                <GripVertical size={15} className="motion-link-grip cursor-grab text-zinc-300 opacity-0 group-hover:opacity-100" />
                {link.faviconUrl ? (
                  <span
                    aria-hidden="true"
                    className="motion-favicon size-5 bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: `url("${link.faviconUrl}")` }}
                  />
                ) : null}
                <a href={link.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-1.5 truncate text-sm font-semibold">{link.title}<ExternalLink size={12} className="motion-external-arrow shrink-0 text-zinc-400" /></h3>
                  <p className="truncate text-xs text-zinc-500">{new URL(link.url).hostname}</p>
                </a>
                <button
                  type="button"
                  onClick={() => remove(link)}
                  aria-label={`Delete ${link.title}`}
                  className="rounded-lg p-1.5 text-zinc-400 opacity-0 hover:bg-[var(--danger-soft)] hover:text-rose-600 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
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
