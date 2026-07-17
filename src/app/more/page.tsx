import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText, Link2, Settings, Sparkles } from "lucide-react";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";

const tools = [
  { href: "/review", title: "Weekly review", copy: "Close the week, spot overload, and rescue next week.", icon: Sparkles },
  { href: "/notes", title: "Notes", copy: "Keep scratch notes, reference, and daily thinking nearby.", icon: FileText },
  { href: "/links", title: "Saved links", copy: "Organize school tools and frequently used resources.", icon: Link2 },
  { href: "/settings", title: "Settings", copy: "Working hours, sources, alerts, and planner preferences.", icon: Settings },
];

export default async function MorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return <div className="app-page" data-page="more"><AppHeader /><main><div className="page-intro"><div><p className="page-kicker">Workspace</p><h1 className="page-title">More</h1><p className="page-description">Reference, reflection, and preferences.</p></div></div><div className="workspace-card more-tools-list">{tools.map(({ href, title, copy, icon: Icon }) => <Link key={href} href={href} className="more-tool-row"><Icon size={19} /><span className="min-w-0 flex-1"><strong>{title}</strong><small>{copy}</small></span><ArrowRight size={16} /></Link>)}</div></main></div>;
}
