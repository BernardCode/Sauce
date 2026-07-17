import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { LinkGrid } from "./link-grid";

export default async function LinksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: links } = await supabase
    .from("links")
    .select("id, title, url, tag, favicon_url")
    .eq("user_id", user.id)
    .order("tag")
    .order("position");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-6">
      <AppHeader />
      <main className="pt-8">
        <h1 className="text-2xl font-semibold">Links</h1>
        <p className="mt-1 text-sm text-zinc-500">Saved pages, grouped by tag.</p>
        <div className="mt-6">
          <LinkGrid initialLinks={(links ?? []).map((link) => ({ id: link.id, title: link.title, url: link.url, tag: link.tag, faviconUrl: link.favicon_url }))} />
        </div>
      </main>
    </div>
  );
}
