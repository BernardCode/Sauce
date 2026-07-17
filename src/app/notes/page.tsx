import { redirect } from "next/navigation";
import { z } from "zod";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { NoteWorkspace } from "./note-workspace";

const searchSchema = z.string().trim().max(100);
const idSchema = z.uuid();

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string; note?: string }> }) {
  const params = await searchParams;
  const query = searchSchema.safeParse(params.q).success ? searchSchema.parse(params.q) : "";
  const selectedId = idSchema.safeParse(params.note).success ? params.note as string : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data } = await supabase
    .from("notes")
    .select("id, title, body_md, pinned, updated_at")
    .eq("user_id", user.id)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  const lowered = query.toLowerCase();
  const notes = (data ?? []).filter((note) => !lowered || note.title.toLowerCase().includes(lowered) || note.body_md.toLowerCase().includes(lowered));
  return (
    <div className="app-page">
      <AppHeader />
      <main>
        <div className="page-intro">
          <div><p className="page-kicker">Capture it before it disappears</p><h1 className="page-title">Notes</h1><p className="page-description">Fast scratch notes, daily thinking, and the details you need close at hand.</p></div>
          <form className="flex gap-2">
            <input name="q" defaultValue={query} placeholder="Search notes" aria-label="Search notes" className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm shadow-sm outline-none focus:border-[var(--primary)]" />
            <button className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--primary-deep)]">Search</button>
          </form>
        </div>
        <div className="workspace-card"><NoteWorkspace
          key={selectedId ?? notes[0]?.id ?? "empty"}
          notes={notes.map((note) => ({ id: note.id, title: note.title, body: note.body_md, pinned: note.pinned, updatedAt: note.updated_at }))}
          selectedId={selectedId}
        /></div>
      </main>
    </div>
  );
}
