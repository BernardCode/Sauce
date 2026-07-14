import { signOut } from "@/app/auth/actions";

export default function TodayPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Today</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="flex flex-1 items-center justify-center text-zinc-500">
        The todo list lands here next.
      </main>
    </div>
  );
}
