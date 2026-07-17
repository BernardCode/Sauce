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
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-6">
      <AppHeader />
      <main className="pt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Notes</h1>
          <form className="flex gap-2">
            <input name="q" defaultValue={query} placeholder="Search notes" aria-label="Search notes" className="rounded border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" />
            <button className="text-sm">Search</button>
          </form>
        </div>
        <NoteWorkspace
          key={selectedId ?? notes[0]?.id ?? "empty"}
          notes={notes.map((note) => ({ id: note.id, title: note.title, body: note.body_md, pinned: note.pinned, updatedAt: note.updated_at }))}
          selectedId={selectedId}
        />
      </main>
    </div>
  );
}
