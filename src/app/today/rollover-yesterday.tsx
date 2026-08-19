"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rolloverUnfinishedItems } from "./actions";

export function RolloverUnfinishedItems() {
  const router = useRouter();
  const started = useRef(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    startTransition(async () => {
      const result = await rolloverUnfinishedItems();
      if (result.changed) router.refresh();
    });
  }, [router]);

  return null;
}
