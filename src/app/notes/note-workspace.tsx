"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, FilePlus2, Pencil, Pin, Trash2 } from "lucide-react";
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
    <div className="motion-note-preview flex flex-col gap-2 text-sm">
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
  const draftReady = useRef(false);

  useEffect(() => {
    if (!activeNoteId) return;
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem(`daylight-note:${activeNoteId}`);
      if (!raw) {
        draftReady.current = true;
        return;
      }
      try {
        const draft = JSON.parse(raw) as { title?: string; body?: string; pinned?: boolean };
        if (typeof draft.title === "string") setTitle(draft.title);
        if (typeof draft.body === "string") setBody(draft.body);
        if (typeof draft.pinned === "boolean") setPinned(draft.pinned);
        setStatus("Draft restored");
      } catch {
        window.localStorage.removeItem(`daylight-note:${activeNoteId}`);
      }
      draftReady.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeNoteId]);

  useEffect(() => {
    if (!activeNoteId || !draftReady.current) return;
    window.localStorage.setItem(
      `daylight-note:${activeNoteId}`,
      JSON.stringify({ title, body, pinned }),
    );
  }, [activeNoteId, body, pinned, title]);

  useEffect(() => {
    if (!activeNoteId || initial.current) {
      initial.current = false;
      return;
    }
    setStatus("Saving");
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await updateNote({ id: activeNoteId, title, body, pinned });
        setStatus(result.error ?? "Saved just now");
        if (!result.error) window.localStorage.removeItem(`daylight-note:${activeNoteId}`);
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
    <div className="motion-note-workspace grid min-h-[70vh] gap-5 md:grid-cols-[17rem_1fr]">
      <aside className="rounded-xl bg-[var(--surface-subtle)] p-3">
        <form onSubmit={add} className="flex gap-2">
          <input name="title" required placeholder="New note" className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" />
          <button disabled={isPending} aria-label="Add note" className="grid size-9 place-items-center rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-deep)]"><FilePlus2 size={16} /></button>
        </form>
        <nav className="mt-4 flex flex-col gap-1" aria-label="Notes">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => router.push(`/notes?note=${note.id}`)}
              data-active={selected?.id === note.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${selected?.id === note.id ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary-deep)]" : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"}`}
            >
              {note.pinned ? <Pin size={13} className="motion-pin shrink-0" fill="currentColor" /> : <span className="size-[13px]" />}{note.title}
            </button>
          ))}
        </nav>
      </aside>
      {selected ? (
        <section data-status={status ?? "idle"} className="motion-note-editor flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] pb-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Note title" className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-[-0.025em] outline-none" />
            <label className="text-sm"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="mr-1" />Pinned</label>
            <button type="button" onClick={() => setPreview((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)]">{preview ? <Pencil size={13} /> : <Eye size={13} />}{preview ? "Edit" : "Preview"}</button>
            <button type="button" aria-label="Delete note" onClick={() => startTransition(async () => { const result = await deleteNote({ id: selected.id }); setStatus(result.error); if (!result.error) router.push("/notes"); })} className="rounded-lg p-1.5 text-zinc-400 hover:bg-[var(--danger-soft)] hover:text-rose-600"><Trash2 size={15} /></button>
          </div>
          <p className="motion-save-status h-4 text-xs text-zinc-500">{status}</p>
          {preview ? (
            <MarkdownPreview body={body} />
          ) : (
            <textarea value={body} onChange={(event) => setBody(event.target.value)} aria-label="Note body" placeholder="Start writing..." className="min-h-[55vh] resize-none bg-transparent p-2 text-[15px] leading-7 outline-none" />
          )}
        </section>
      ) : (
        <p className="text-sm text-zinc-500">Create a note to start writing.</p>
      )}
    </div>
  );
}
