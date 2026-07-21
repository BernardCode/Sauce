import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { createClient } from "@/lib/supabase/server";
import { SatWorkspace } from "./sat-workspace";

export default async function SatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile } = await supabase
    .from("sat_profiles")
    .select("test_date, test_dates")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="app-page" data-page="sat">
      <AppHeader />
      <main>
        <div className="page-intro">
          <h1 className="page-title">SAT studio</h1>
        </div>
        <p className="sat-page-note">
          Log a practice set to personalize your plan.
        </p>
        <SatWorkspace
          key={(profile?.test_dates ?? []).join("|") || "no-test-dates"}
          initialTestDates={
            profile?.test_dates?.length
              ? profile.test_dates
              : profile?.test_date
                ? [profile.test_date]
                : []
          }
        />
      </main>
    </div>
  );
}
