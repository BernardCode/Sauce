import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Clock3, Target } from "lucide-react";

export function StudentBriefing({ overdue, dueSoon, plannedMinutes, satReviews }: { overdue: number; dueSoon: number; plannedMinutes: number; satReviews: number }) {
  const needsAttention = overdue > 0 || dueSoon > 0 || satReviews > 0;
  return (
    <section className="student-briefing mt-5">
      <div className="student-briefing-copy"><div className="flex items-center gap-2 text-sm font-semibold">{needsAttention ? <AlertTriangle size={16} className="text-amber-500" /> : <Target size={16} className="text-emerald-500" />}Daily briefing</div><p>{needsAttention ? "A few things deserve a decision today." : "Your plan is clear and under control."}</p></div>
      <div className="student-briefing-metrics">
        <Link href="/assignments?filter=overdue"><strong className={overdue ? "text-rose-600" : ""}>{overdue}</strong><span>Overdue</span></Link>
        <Link href="/assignments"><strong className={dueSoon ? "text-amber-600" : ""}>{dueSoon}</strong><span>Due soon</span></Link>
        <div><strong><Clock3 size={14} />{plannedMinutes}m</strong><span>Planned</span></div>
        <Link href="/sat"><strong><BookOpen size={14} />{satReviews}</strong><span>SAT reviews</span></Link>
      </div>
      <Link href="/focus" className="motion-forward student-briefing-action">Focus now <ArrowRight size={15} /></Link>
    </section>
  );
}
