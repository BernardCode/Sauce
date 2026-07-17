"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { CommandMenu } from "@/app/components/command-menu";
import { AppQuickActions } from "@/app/components/app-quick-actions";

const links = [
  { href: "/today", label: "Today", short: "Today", icon: LayoutDashboard, accent: "today" },
  { href: "/assignments", label: "Assignments", short: "Work", icon: ListTodo, accent: "assignments" },
  { href: "/calendar", label: "Calendar", short: "Calendar", icon: CalendarDays, accent: "calendar" },
  { href: "/sat", label: "SAT Studio", short: "SAT", icon: BookOpenCheck, accent: "sat" },
  { href: "/habits", label: "Habits", short: "Habits", icon: CheckCircle2, accent: "habits" },
  { href: "/more", label: "More", short: "More", icon: Settings, accent: "settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/today") return pathname === href || pathname.startsWith("/projects/") || pathname === "/focus";
  if (href === "/more") return ["/more", "/notes", "/links", "/review", "/settings"].some((path) => pathname === path || pathname.startsWith(`${path}/`));
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
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
                {active ? <ChevronRight className="motion-nav-chevron ml-auto" size={15} /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-status-card" aria-label="Save status">
            <span className="app-status-dot" />
            <div>
              <strong>Saved automatically</strong>
              <small>Fast on this device</small>
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
          <span className="app-topbar-eyebrow">Daylight</span>
          <p>Your school day, organized</p>
        </div>
        <div className="flex items-center gap-2"><CommandMenu /><AppQuickActions /><div className="app-live-pill"><span /> Instant updates</div><ThemeToggle /></div>
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
