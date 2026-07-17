import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle } from "@/app/auth/actions";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { ArrowRight, CalendarDays, CheckCircle2, ListTodo, Sparkles } from "lucide-react";

const homeQuerySchema = z.object({
  error: z.enum(["signin", "calendar"]).optional(),
});

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/today");
  }

  const parsedQuery = homeQuerySchema.safeParse(await searchParams);
  const showSignInError =
    parsedQuery.success && parsedQuery.data.error === "signin";
  const showCalendarError =
    parsedQuery.success && parsedQuery.data.error === "calendar";

  return (
    <main className="motion-auth relative flex flex-1 items-center justify-center overflow-hidden p-5 sm:p-8">
      <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>
      <div className="motion-auth-glow motion-auth-glow-one absolute left-[-12rem] top-[-12rem] size-[30rem] rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="motion-auth-glow motion-auth-glow-two absolute bottom-[-14rem] right-[-10rem] size-[34rem] rounded-full bg-violet-300/20 blur-3xl" />
      <div className="motion-auth-shell relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] shadow-2xl shadow-indigo-950/10 md:grid-cols-[1.2fr_0.8fr]">
        <section className="p-8 sm:p-12">
          <div className="motion-auth-badge inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-deep)]"><Sparkles size={14} /> Your day, made clear</div>
          <h1 className="motion-auth-title mt-6 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">Meet <span className="text-[var(--primary)]">Daylight.</span></h1>
          <p className="motion-auth-copy mt-5 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">One calm place for everything you need to do, when you plan to do it, and the habits that keep you moving.</p>
          <form action={signInWithGoogle} className="mt-8">
            <button type="submit" className="motion-forward inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 hover:bg-[var(--primary-deep)]">Continue with Google <ArrowRight size={17} /></button>
          </form>
          <p className="mt-4 text-xs text-[var(--muted)]">Private by default. Calendar access is read-only.</p>
        </section>
        <aside className="flex flex-col justify-center gap-3 border-t border-[var(--line)] bg-[var(--surface-subtle)] p-8 md:border-l md:border-t-0 sm:p-10">
          {[{ icon: ListTodo, title: "Know what you owe", copy: "Tasks and projects stay clear and prioritized." }, { icon: CalendarDays, title: "Own your time", copy: "Turn obligations into a realistic daily plan." }, { icon: CheckCircle2, title: "Build momentum", copy: "Keep habits, notes, and progress close by." }].map(({ icon: Icon, title, copy }, index) => (
            <div key={title} className="motion-auth-feature flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm" style={{ animationDelay: `${180 + index * 70}ms` }}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon size={19} /></span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{copy}</p></div></div>
          ))}
        </aside>
      </div>
      {showSignInError && (
        <p className="absolute bottom-5 rounded-full bg-[var(--danger-soft)] px-3 py-1.5 text-sm text-red-600">Sign-in failed. Try again.</p>
      )}
      {showCalendarError && (
        <p className="absolute bottom-5 rounded-full bg-[var(--danger-soft)] px-3 py-1.5 text-sm text-red-600">
          Signed in, but Calendar access could not be saved. Try again.
        </p>
      )}
    </main>
  );
}
