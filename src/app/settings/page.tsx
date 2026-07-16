import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/auth/actions";
import { AppHeader } from "@/app/components/app-header";
import { plannerPreferencesSchema, workingHoursSchema } from "@/lib/planner/schemas";
import { createClient } from "@/lib/supabase/server";
import { PlannerSettingsForm } from "./planner-settings-form";
import { SourceControls } from "./source-controls";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: sources }, { data: events }, { data: profile }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, kind, label, enabled, last_synced_at, last_error")
      .eq("user_id", user.id)
      .order("label"),
    supabase.from("events").select("source_id").eq("user_id", user.id),
    supabase
      .from("users")
      .select("timezone, working_hours_json, planner_prefs_json")
      .eq("id", user.id)
      .single(),
  ]);
  const eventCounts = new Map<string, number>();
  for (const event of events ?? []) {
    eventCounts.set(event.source_id, (eventCounts.get(event.source_id) ?? 0) + 1);
  }
  const hours = workingHoursSchema.safeParse(profile?.working_hours_json ?? {});
  const preferences = plannerPreferencesSchema.safeParse(
    profile?.planner_prefs_json ?? {},
  );
  const plannerHours = hours.success ? hours.data : workingHoursSchema.parse({});

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col p-6">
      <AppHeader />
      <main className="flex flex-col gap-8 pt-6">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Calendar sources are read-only. The dashboard never writes back.
          </p>
        </div>
        <PlannerSettingsForm
          initialTimezone={profile?.timezone ?? "UTC"}
          initialWake={plannerHours.wake}
          initialSleep={plannerHours.sleep}
          initialWindows={plannerHours.blockedWindows}
          initialPreferences={preferences.success ? preferences.data.text : ""}
        />
        <section>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-medium">Sources</h2>
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-50 dark:text-zinc-900"
              >
                Connect Google Calendar
              </button>
            </form>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(sources ?? []).map((source) => (
              <article
                key={source.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <h3 className="text-sm font-medium">{source.label}</h3>
                  <p className="text-xs text-zinc-500">
                    {eventCounts.get(source.id) ?? 0} events
                    {source.last_synced_at
                      ? `, synced ${new Date(source.last_synced_at).toLocaleString()}`
                      : ", not synced yet"}
                  </p>
                  {source.last_error ? (
                    <p className="mt-1 text-xs text-red-600">{source.last_error}</p>
                  ) : null}
                </div>
                <SourceControls id={source.id} enabled={source.enabled} />
              </article>
            ))}
            {(sources ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                No calendar connected.
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
