import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { signInWithGoogle } from "@/app/auth/actions";

const homeQuerySchema = z.object({
  error: z.literal("signin").optional(),
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

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Personal dashboard</h1>
        <p className="mt-2 text-zinc-500">
          What should I be doing right now?
        </p>
      </div>
      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Sign in with Google
        </button>
      </form>
      {showSignInError && (
        <p className="text-sm text-red-600">Sign-in failed. Try again.</p>
      )}
    </main>
  );
}
