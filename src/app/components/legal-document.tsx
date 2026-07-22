import Link from "next/link";
import type { ReactNode } from "react";

type LegalDocumentProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function LegalDocument({
  title,
  description,
  children,
}: LegalDocumentProps) {
  return (
    <main className="legal-page">
      <article className="legal-document">
        <header className="legal-header">
          <Link href="/" className="legal-brand" aria-label="sauce home">
            sauce
          </Link>
          <div>
            <p className="legal-eyebrow">Legal</p>
            <h1>{title}</h1>
            <p className="legal-description">{description}</p>
            <p className="legal-effective-date">Effective July 21, 2026</p>
          </div>
        </header>

        <div className="legal-copy">{children}</div>

        <footer className="legal-footer">
          <nav aria-label="Legal pages">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
          <Link href="/">Back to sauce</Link>
        </footer>
      </article>
    </main>
  );
}
