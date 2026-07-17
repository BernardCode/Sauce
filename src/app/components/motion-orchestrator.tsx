"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function MotionOrchestrator({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="motion-route flex min-h-full flex-1 flex-col">
      {children}
    </div>
  );
}
