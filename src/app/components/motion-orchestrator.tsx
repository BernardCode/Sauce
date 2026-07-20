import type { ReactNode } from "react";

export function MotionOrchestrator({ children }: { children: ReactNode }) {
  return (
    <div className="motion-route flex min-h-full flex-1 flex-col">
      {children}
    </div>
  );
}
