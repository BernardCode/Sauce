export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--background)] p-6">
      <div className="motion-loading flex flex-col items-center">
        <p className="text-lg font-semibold tracking-[-0.03em]">sauce</p>
        <div className="motion-loading-track mt-3 h-0.5 w-24 overflow-hidden bg-[var(--line)]"><div className="h-full w-1/2 bg-[var(--task-accent)]" /></div>
      </div>
    </div>
  );
}
