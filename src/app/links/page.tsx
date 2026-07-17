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
    <div className="app-page">
      <AppHeader />
      <main>
        <div className="page-intro">
          <div><p className="page-kicker">Your useful corner of the web</p><h1 className="page-title">Saved links</h1><p className="page-description">Keep school, tools, reading, and frequently used pages organized without another row of tabs.</p></div>
        </div>
        <div className="workspace-card">
          <LinkGrid
            key={(links ?? []).map((link) => link.id).join(":")}
            initialLinks={(links ?? []).map((link) => ({ id: link.id, title: link.title, url: link.url, tag: link.tag, faviconUrl: link.favicon_url }))}
          />
        </div>
      </main>
    </div>
  );
}
