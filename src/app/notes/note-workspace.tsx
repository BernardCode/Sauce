"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createNote, deleteNote, updateNote } from "./actions";

export type NoteRow = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updatedAt: string;
};

function MarkdownPreview({ body }: { body: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {body.split("\n").map((line, index) => {
        if (line.startsWith("# ")) return <h2 key={index} className="text-xl font-semibold">{line.slice(2)}</h2>;
        if (line.startsWith("## ")) return <h3 key={index} className="text-lg font-semibold">{line.slice(3)}</h3>;
        if (line.startsWith("- ")) return <p key={index} className="pl-4">• {line.slice(2)}</p>;
        return <p key={index} className="min-h-5 whitespace-pre-wrap">{line}</p>;
      })}
    </div>
  );
}

export function NoteWorkspace({ notes, selectedId }: { notes: NoteRow[]; selectedId: string | null }) {
  const router = useRouter();
  const selected = notes.find((note) => note.id === selectedId) ?? notes[0] ?? null;
  const activeNoteId = selected?.id ?? null;
  const [title, setTitle] = useState(selected?.title ?? "");
  const [body, setBody] = useState(selected?.body ?? "");
  const [pinned, setPinned] = useState(selected?.pinned ?? false);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const initial = useRef(true);

  useEffect(() => {
    if (!activeNoteId || initial.current) {
      initial.current = false;
      return;
    }
    setStatus("Saving");
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await updateNote({ id: activeNoteId, title, body, pinned });
        setStatus(result.error ?? "Saved");
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activeNoteId, body, pinned, title]);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createNote({ title: String(data.get("title") ?? "") });
      setStatus(result.error);
      if (result.id) router.push(`/notes?note=${result.id}`);
    });
  }

  return (
    <div className="grid min-h-[70vh] gap-6 md:grid-cols-[16rem_1fr]">
      <aside className="border-r border-zinc-200 pr-4 dark:border-zinc-800">
        <form onSubmit={add} className="flex gap-2">
          <input name="title" required placeholder="New note" className="min-w-0 flex-1 rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700" />
          <button disabled={isPending} className="text-sm">Add</button>
        </form>
        <nav className="mt-4 flex flex-col gap-1" aria-label="Notes">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => router.push(`/notes?note=${note.id}`)}
              className={`rounded px-2 py-2 text-left text-sm ${selected?.id === note.id ? "bg-zinc-100 dark:bg-zinc-900" : ""}`}
            >
              {note.pinned ? "● " : ""}{note.title}
            </button>
          ))}
        </nav>
      </aside>
      {selected ? (
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Note title" className="min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none" />
            <label className="text-sm"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="mr-1" />Pinned</label>
            <button type="button" onClick={() => setPreview((value) => !value)} className="text-sm">{preview ? "Edit" : "Preview"}</button>
            <button type="button" onClick={() => startTransition(async () => { const result = await deleteNote({ id: selected.id }); setStatus(result.error); if (!result.error) router.push("/notes"); })} className="text-sm text-red-600">Delete</button>
          </div>
          <p className="h-4 text-xs text-zinc-500">{status}</p>
          {preview ? (
            <MarkdownPreview body={body} />
          ) : (
            <textarea value={body} onChange={(event) => setBody(event.target.value)} aria-label="Note body" className="min-h-[55vh] resize-none rounded-lg border border-zinc-200 bg-transparent p-4 font-mono text-sm outline-none dark:border-zinc-800" />
          )}
        </section>
      ) : (
        <p className="text-sm text-zinc-500">Create a note to start writing.</p>
      )}
    </div>
  );
}
