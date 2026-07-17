export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)] p-6">
      <div className="flex animate-pulse flex-col items-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold text-white shadow-xl shadow-indigo-500/20">D</div>
        <p className="mt-4 text-sm font-semibold tracking-[-0.02em]">Opening Daylight</p>
        <div className="mt-3 h-1 w-24 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950"><div className="h-full w-1/2 rounded-full bg-[var(--primary)]" /></div>
      </div>
    </div>
  );
}
