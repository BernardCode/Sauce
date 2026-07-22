import type { Metadata } from "next";
import { LegalDocument } from "@/app/components/legal-document";

export const metadata: Metadata = {
  title: "Terms of Service | sauce",
  description: "The terms that apply when you use sauce.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      description="The simple rules that apply when you use sauce."
    >
      <section>
        <h2>Using sauce</h2>
        <p>
          sauce is a personal productivity service for organizing tasks,
          schedules, habits, notes, links, and SAT practice. By using sauce, you
          agree to these terms and the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You are responsible for your Google account, the activity performed
          through your sauce account, and keeping your sign-in access secure. You
          must provide accurate information and use sauce only where you are
          legally allowed to do so.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not misuse sauce, attempt to bypass its security, access another
          person&apos;s information, disrupt the service, upload unlawful content, or
          use the service in a way that violates another person&apos;s rights or
          applicable law.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You keep ownership of the information you add to sauce. You give sauce
          permission to process that information only as needed to provide,
          maintain, secure, and improve the features you choose to use.
        </p>
      </section>

      <section>
        <h2>Connected services</h2>
        <p>
          sauce can connect to Google Calendar and, if you configure it, Claude.
          Those services have their own terms and policies. You may disconnect a
          connected service at any time. sauce is not responsible for the
          availability or independent actions of third-party services.
        </p>
      </section>

      <section>
        <h2>Google API data</h2>
        <p>
          sauce&apos;s use and transfer of information received from Google APIs will
          follow the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements.
        </p>
      </section>

      <section>
        <h2>Service availability</h2>
        <p>
          sauce may change, pause, or discontinue features. The service is
          provided as available, without a promise that it will always be
          uninterrupted or error-free. You should keep independent copies of
          information you cannot afford to lose.
        </p>
      </section>

      <section>
        <h2>Limitation of responsibility</h2>
        <p>
          To the extent allowed by law, the developer is not responsible for
          indirect, incidental, or consequential losses resulting from your use of
          sauce. Nothing in these terms limits rights or responsibilities that
          cannot legally be limited.
        </p>
      </section>

      <section>
        <h2>Ending access</h2>
        <p>
          You may stop using sauce at any time. Access may be suspended or ended
          if you violate these terms, create risk for other people or the service,
          or if the service is discontinued.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          These terms may change as sauce changes. The effective date above will
          be updated when material changes are published. For questions, use the
          support email shown on the sauce Google OAuth consent screen.
        </p>
      </section>
    </LegalDocument>
  );
}
