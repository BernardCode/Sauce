import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText, Link2, Settings, Sparkles } from "lucide-react";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";

const tools = [
  { href: "/review", title: "Weekly review", copy: "Close the week, spot overload, and rescue next week.", icon: Sparkles, color: "#8b5cf6" },
  { href: "/notes", title: "Notes", copy: "Keep scratch notes, reference, and daily thinking nearby.", icon: FileText, color: "#0ea5e9" },
  { href: "/links", title: "Saved links", copy: "Organize school tools and frequently used resources.", icon: Link2, color: "#f59e0b" },
  { href: "/settings", title: "Settings", copy: "Working hours, sources, alerts, and planner preferences.", icon: Settings, color: "#64748b" },
];

export default async function MorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return <div className="app-page" data-page="more"><AppHeader /><main><div className="page-intro"><div><p className="page-kicker">Everything else, still close</p><h1 className="page-title">More tools</h1><p className="page-description">Review your week, keep useful reference, or adjust how Daylight plans.</p></div></div><div className="grid gap-4 sm:grid-cols-2">{tools.map(({ href, title, copy, icon: Icon, color }) => <Link key={href} href={href} className="group workspace-card flex min-h-40 items-start gap-4 p-5"><span className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}><Icon size={21} /></span><span className="min-w-0 flex-1"><strong className="text-lg">{title}</strong><small className="mt-2 block max-w-md text-sm leading-6 text-[var(--muted)]">{copy}</small><span className="motion-forward mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[var(--primary)]">Open <ArrowRight size={13} /></span></span></Link>)}</div></main></div>;
}
