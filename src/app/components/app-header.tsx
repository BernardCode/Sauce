"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { CommandMenu } from "@/app/components/command-menu";
import { AppQuickActions } from "@/app/components/app-quick-actions";

const links = [
  { href: "/today", label: "Today", short: "Today" },
  { href: "/calendar", label: "Calendar", short: "Calendar" },
  { href: "/sat", label: "SAT Studio", short: "SAT" },
  { href: "/habits", label: "Habits", short: "Habits" },
  { href: "/more", label: "More", short: "More" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/today") return pathname === href || pathname === "/focus";
  if (href === "/more") return ["/more", "/projects", "/notes", "/links", "/review", "/settings"].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader() {
  const pathname = usePathname();

  return (
    <>
      <aside className="app-sidebar" aria-label="Dashboard navigation">
        <Link href="/today" className="app-brand">
          <strong>sauce</strong>
        </Link>

        <nav className="app-nav" aria-label="Main navigation">
          {links.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} className="app-nav-link" data-active={active}>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <form action={signOut}>
            <button type="submit" className="app-signout">
              Sign out
            </button>
          </form>
          <nav className="app-legal-links" aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </aside>

      <header className="app-topbar">
        <div className="app-topbar-brand">sauce</div>
        <div className="flex items-center gap-2"><CommandMenu /><AppQuickActions /><ThemeToggle /></div>
      </header>

      <nav className="app-mobile-nav" aria-label="Mobile navigation">
        {links.map(({ href, short }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} data-active={active}>
              <span>{short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
