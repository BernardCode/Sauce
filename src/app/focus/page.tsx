import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BatteryFull, BatteryLow, BatteryMedium, CalendarClock, CircleDot, Sparkles } from "lucide-react";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { FocusSession } from "./focus-session";

const energyIcons = { low: BatteryLow, medium: BatteryMedium, high: BatteryFull };

export default async function FocusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const now = new Date().toISOString();
  const { data: blocks } = await supabase.from("blocks").select("id, item_id, title, start_at, end_at, reason").eq("user_id", user.id).eq("done", false).gt("end_at", now).order("start_at").limit(1);
  const block = blocks?.[0] ?? null;
  const { data: item } = block?.item_id ? await supabase.from("items").select("id, title, description, course, due_at, remaining_minutes, energy").eq("id", block.item_id).eq("user_id", user.id).maybeSingle() : { data: null };
  const EnergyIcon = energyIcons[(item?.energy ?? "medium") as keyof typeof energyIcons];
  return (
    <div className="app-page" data-page="focus"><AppHeader /><main>
      <div className="page-intro"><div><p className="page-kicker">One thing at a time</p><h1 className="page-title">Do now</h1><p className="page-description">Everything except the next useful action has been moved out of the way.</p></div><Link href="/today" className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]"><ArrowLeft size={15} />Back to Today</Link></div>
      {block ? <div className="mx-auto grid w-full max-w-4xl gap-5 lg:grid-cols-[1fr_18rem]">
        <section className="focus-card"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--primary)]"><Sparkles size={15} />Best next action</div><h2>{block.title}</h2><p>{block.reason ?? "This is the next open block in your plan."}</p><div className="focus-session"><FocusSession blockId={block.id} itemId={block.item_id} /></div></section>
        <aside className="flex flex-col gap-3"><div className="workspace-card"><div className="flex items-center gap-2 text-sm font-semibold"><CalendarClock size={16} className="text-sky-500" />Time window</div><p className="mt-2 text-sm text-[var(--muted)]">{new Date(block.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} to {new Date(block.end_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div>{item ? <><div className="workspace-card"><div className="flex items-center gap-2 text-sm font-semibold"><EnergyIcon size={16} className="text-amber-500" />Energy match</div><p className="mt-2 text-sm capitalize text-[var(--muted)]">{item.energy} energy, {item.remaining_minutes ?? "unknown"} minutes remaining</p></div><div className="workspace-card"><div className="flex items-center gap-2 text-sm font-semibold"><CircleDot size={16} className="text-[var(--task-accent)]" />Details</div><p className="mt-2 text-sm text-[var(--muted)]">{item.description || `${item.course ?? "General"}${item.due_at ? `, due ${new Date(item.due_at).toLocaleString()}` : ""}`}</p></div></> : null}</aside>
      </div> : <section className="mx-auto max-w-2xl rounded-[1.75rem] border border-dashed border-[var(--line)] bg-[var(--surface)] p-12 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--success-soft)] text-emerald-600"><Sparkles size={23} /></div><h2 className="mt-5 text-2xl font-semibold">Your time is open</h2><p className="mt-2 text-sm text-[var(--muted)]">Schedule an assignment or choose one from the assignment list.</p><Link href="/assignments" className="mt-5 inline-flex rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Choose an assignment</Link></section>}
    </main></div>
  );
}
