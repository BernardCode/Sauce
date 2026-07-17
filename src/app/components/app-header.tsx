"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Link2,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { ThemeToggle } from "@/app/components/theme-toggle";

const links = [
  { href: "/today", label: "Today", short: "Today", icon: LayoutDashboard, accent: "today" },
  { href: "/calendar", label: "Calendar", short: "Calendar", icon: CalendarDays, accent: "calendar" },
  { href: "/habits", label: "Habits", short: "Habits", icon: CheckCircle2, accent: "habits" },
  { href: "/notes", label: "Notes", short: "Notes", icon: FileText, accent: "notes" },
  { href: "/links", label: "Links", short: "Links", icon: Link2, accent: "links" },
  { href: "/settings", label: "Settings", short: "More", icon: Settings, accent: "settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/today") return pathname === href || pathname.startsWith("/projects/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader() {
  const pathname = usePathname();

  return (
    <>
      <aside className="app-sidebar" aria-label="Dashboard navigation">
        <Link href="/today" className="app-brand">
          <span className="app-brand-mark"><Sparkles size={18} strokeWidth={2.25} /></span>
          <span>
            <strong>Daylight</strong>
            <small>Personal command center</small>
          </span>
        </Link>

        <nav className="app-nav" aria-label="Main navigation">
          <p className="app-nav-label">Workspace</p>
          {links.map(({ href, label, icon: Icon, accent }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} className={`app-nav-link app-nav-${accent}`} data-active={active}>
                <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
                <span>{label}</span>
                {active ? <ChevronRight className="ml-auto" size={15} /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-status-card">
            <span className="app-status-dot" />
            <div>
              <strong>Ready when you are</strong>
              <small>Changes save automatically</small>
            </div>
          </div>
          <form action={signOut}>
            <button type="submit" className="app-signout">
              <LogOut size={16} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <header className="app-topbar">
        <div>
          <span className="app-topbar-eyebrow">Personal workspace</span>
          <p>Tasks, time, and momentum in one place</p>
        </div>
        <div className="flex items-center gap-2"><div className="app-live-pill"><span /> Instant updates</div><ThemeToggle /></div>
      </header>

      <nav className="app-mobile-nav" aria-label="Mobile navigation">
        {links.map(({ href, short, icon: Icon, accent }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className={`app-nav-${accent}`} data-active={active}>
              <Icon size={20} strokeWidth={active ? 2.4 : 1.9} />
              <span>{short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
