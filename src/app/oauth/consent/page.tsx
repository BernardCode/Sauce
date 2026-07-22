import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signInWithGoogle } from "@/app/auth/actions";
import { decideOAuthAuthorization } from "@/app/oauth/consent/actions";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  authorization_id: z.string().trim().min(1).max(1_024),
  error: z
    .enum(["invalid", "configuration", "unauthorized", "decision"])
    .optional(),
});

const environmentSchema = z.object({ userId: z.uuid() });

const redirectUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
});

function ConsentShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-5 text-[var(--foreground)] sm:p-8">
      <section className="w-full max-w-lg border-t border-[var(--line-strong)] pt-8">
        <Link href="/" className="text-sm font-semibold tracking-[-0.03em]">
          sauce
        </Link>
        {children}
        <nav
          className="mt-10 flex gap-4 text-xs text-[var(--muted)]"
          aria-label="Legal"
        >
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </section>
    </main>
  );
}

function ConsentError({ message }: { message: string }) {
  return (
    <ConsentShell>
      <h1 className="mt-8 text-3xl font-semibold tracking-[-0.04em]">
        Connection paused
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{message}</p>
    </ConsentShell>
  );
}

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = querySchema.safeParse(await searchParams);
  if (!query.success) {
    return <ConsentError message="This authorization request is incomplete." />;
  }

  const environment = environmentSchema.safeParse({
    userId: process.env.MCP_USER_ID,
  });
  if (!environment.success || query.data.error === "configuration") {
    return <ConsentError message="OAuth is not configured for this dashboard." />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const nextPath = `/oauth/consent?authorization_id=${encodeURIComponent(query.data.authorization_id)}`;

  if (!user) {
    return (
      <ConsentShell>
        <h1 className="mt-8 text-3xl font-semibold tracking-[-0.04em]">
          Sign in to connect Claude
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Use the Google account that owns this dashboard. You will return here
          to review access.
        </p>
        <form action={signInWithGoogle} className="mt-8">
          <input type="hidden" name="next" value={nextPath} />
          <button
            type="submit"
            className="bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)] hover:opacity-80"
          >
            Continue with Google
          </button>
        </form>
      </ConsentShell>
    );
  }

  if (user.id !== environment.data.userId || query.data.error === "unauthorized") {
    return <ConsentError message="This account does not own the dashboard." />;
  }

  const { data: details, error } =
    await supabase.auth.oauth.getAuthorizationDetails(
      query.data.authorization_id,
    );
  if (error || !details || query.data.error === "decision") {
    return (
      <ConsentError message="The authorization request expired or could not be completed. Return to Claude and connect again." />
    );
  }

  if (!("authorization_id" in details)) {
    const redirectUrl = redirectUrlSchema.safeParse(details.redirect_url);
    if (!redirectUrl.success) {
      return <ConsentError message="The connector returned an invalid callback." />;
    }
    redirect(redirectUrl.data);
  }

  const scopes = details.scope.split(/\s+/).filter(Boolean);
  return (
    <ConsentShell>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Claude connector
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
        Allow {details.client.name} to use sauce?
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Claude will be able to read your planning context and use the narrow
        dashboard tools you approve. It cannot access the database directly.
      </p>

      <div className="mt-7 border-y border-[var(--line)] py-5">
        <p className="text-sm font-semibold">Requested access</p>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
          {scopes.length ? (
            scopes.map((scope) => <li key={scope}>{scope}</li>)
          ) : (
            <li>Use the personal dashboard planning tools</li>
          )}
        </ul>
      </div>

      <form action={decideOAuthAuthorization} className="mt-7 flex gap-3">
        <input
          type="hidden"
          name="authorization_id"
          value={details.authorization_id}
        />
        <button
          type="submit"
          name="decision"
          value="approve"
          className="bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)] hover:opacity-80"
        >
          Allow
        </button>
        <button
          type="submit"
          name="decision"
          value="deny"
          className="border border-[var(--line-strong)] px-5 py-3 text-sm font-semibold hover:bg-[var(--surface-subtle)]"
        >
          Deny
        </button>
      </form>
    </ConsentShell>
  );
}
