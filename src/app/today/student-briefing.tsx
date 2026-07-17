import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Clock3, Target } from "lucide-react";

export function StudentBriefing({ overdue, dueSoon, plannedMinutes, satReviews }: { overdue: number; dueSoon: number; plannedMinutes: number; satReviews: number }) {
  const needsAttention = overdue > 0 || dueSoon > 0 || satReviews > 0;
  return (
    <section className="mt-5 grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[1fr_repeat(4,auto)] xl:items-center">
      <div className="px-2"><div className="flex items-center gap-2 text-sm font-semibold">{needsAttention ? <AlertTriangle size={16} className="text-amber-500" /> : <Target size={16} className="text-emerald-500" />}Daily briefing</div><p className="mt-1 text-xs text-[var(--muted)]">{needsAttention ? "A few things deserve a decision today." : "Your plan is clear and under control."}</p></div>
      <Link href="/assignments?filter=overdue" className="rounded-xl bg-[var(--danger-soft)] px-3 py-2"><span className="block text-lg font-semibold text-rose-600">{overdue}</span><span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">overdue</span></Link>
      <Link href="/assignments" className="rounded-xl bg-[var(--warning-soft)] px-3 py-2"><span className="block text-lg font-semibold text-amber-600">{dueSoon}</span><span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">due in 24h</span></Link>
      <div className="rounded-xl bg-[var(--sky-soft)] px-3 py-2"><span className="flex items-center gap-1 text-lg font-semibold text-sky-600"><Clock3 size={15} />{plannedMinutes}m</span><span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">planned</span></div>
      <Link href="/sat" className="rounded-xl bg-[var(--primary-soft)] px-3 py-2"><span className="flex items-center gap-1 text-lg font-semibold text-[var(--primary-deep)]"><BookOpen size={15} />{satReviews}</span><span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">SAT reviews</span></Link>
      <Link href="/focus" className="motion-forward inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">Do now <ArrowRight size={15} /></Link>
    </section>
  );
}
