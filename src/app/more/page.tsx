import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";

const tools = [
  { href: "/review", title: "Weekly review" },
  { href: "/notes", title: "Notes" },
  { href: "/links", title: "Saved links" },
  { href: "/settings", title: "Settings" },
];

export default async function MorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return <div className="app-page" data-page="more"><AppHeader /><main><div className="page-intro"><h1 className="page-title">More</h1></div><div className="more-tools-list">{tools.map(({ href, title }) => <Link key={href} href={href} className="more-tool-row"><strong>{title}</strong></Link>)}</div></main></div>;
}
