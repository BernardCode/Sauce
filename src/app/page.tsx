import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle } from "@/app/auth/actions";
import { ThemeToggle } from "@/app/components/theme-toggle";

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
    <main className="motion-auth relative flex flex-1 items-center justify-center bg-[var(--background)] p-5 text-[var(--foreground)] sm:p-8">
      <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>
      <section className="motion-auth-shell w-full max-w-md border-t border-[var(--line-strong)] pt-8">
          <h1 className="motion-auth-title text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">sauce</h1>
          <form action={signInWithGoogle} className="mt-10">
            <button type="submit" className="bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)] hover:opacity-80">Continue with Google</button>
          </form>
      </section>
      {showSignInError && (
        <p className="absolute bottom-5 border border-[var(--line-strong)] px-3 py-1.5 text-sm">Sign-in failed. Try again.</p>
      )}
      {showCalendarError && (
        <p className="absolute bottom-5 border border-[var(--line-strong)] px-3 py-1.5 text-sm">
          Signed in, but Calendar access could not be saved. Try again.
        </p>
      )}
    </main>
  );
}
