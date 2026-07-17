import Link from "next/link";
import { signOut } from "@/app/auth/actions";

const links = [
  { href: "/today", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/habits", label: "Habits" },
  { href: "/settings", label: "Settings" },
];

export function AppHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <nav aria-label="Main navigation" className="flex items-center gap-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <form action={signOut}>
        <button
          type="submit"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
