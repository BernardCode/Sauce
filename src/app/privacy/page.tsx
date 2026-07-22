import type { Metadata } from "next";
import { LegalDocument } from "@/app/components/legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy | sauce",
  description: "How sauce collects, uses, stores, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="How sauce handles the information you choose to connect and create."
    >
      <section>
        <h2>What sauce collects</h2>
        <p>
          sauce stores the information needed to run your personal dashboard. This
          includes your account identifier and email address, plus the tasks,
          schedules, habits, notes, SAT practice records, links, and settings you
          create in the app.
        </p>
      </section>

      <section>
        <h2>Google user data</h2>
        <p>
          When you sign in with Google and grant Calendar access, sauce receives
          basic account information and read-only access to your primary Google
          Calendar. sauce reads event titles, times, all-day status, and locations
          so your existing commitments can appear in your schedule and prevent
          planning conflicts. sauce cannot create, edit, or delete events in your
          Google Calendar. sauce&apos;s use and transfer of information received from
          Google APIs follows the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements.
        </p>
      </section>

      <section>
        <h2>How information is used</h2>
        <p>
          Your information is used only to authenticate you, display and sync your
          dashboard, generate the schedules you request, maintain app reliability,
          and protect the service. sauce does not sell personal information, use it
          for advertising, or use Google user data to train generalized AI models.
        </p>
      </section>

      <section>
        <h2>Optional Claude connection</h2>
        <p>
          If you configure the optional Claude connector, selected dashboard
          context may be sent at your direction to Anthropic so Claude can create
          or update a schedule you requested. That context can include open tasks,
          habits, schedule blocks, and Google Calendar conflicts. Your use of
          Claude is also governed by Anthropic&apos;s terms and privacy policy.
        </p>
      </section>

      <section>
        <h2>Storage and sharing</h2>
        <p>
          Account and dashboard data is stored with Supabase, and the application
          is hosted by Vercel. Google credentials are encrypted before storage.
          Information is shared with these service providers only as needed to
          operate sauce, with Anthropic only when you use the optional Claude
          connection, when you direct sauce to share it, or when required by law.
          Data is not shared with data brokers or advertisers.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          Dashboard data is kept while your account is active. Google credentials
          and imported Calendar event copies are kept while the Google Calendar
          connection remains enabled or as needed to provide the service. You can
          revoke sauce&apos;s Google access at any time from your Google Account. To
          request deletion of remaining account data, contact the developer using
          the support email shown on the sauce Google OAuth consent screen.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          sauce uses access controls, per-user database policies, encrypted Google
          credentials, and secure connections to protect your information. No
          system is perfectly secure, but access is limited to what is needed to
          operate and maintain the service.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You may stop using sauce, revoke Google access, or request deletion of
          your account data. Revoking Google access stops future Calendar access
          but does not automatically delete other information you created in sauce.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          This policy may change as sauce changes. The effective date above will be
          updated when material changes are published. For privacy questions or
          deletion requests, use the support email shown on the sauce Google OAuth
          consent screen.
        </p>
      </section>
    </LegalDocument>
  );
}
