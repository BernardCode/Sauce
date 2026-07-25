"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/browser";

const refreshDebounceMs = 250;
const refreshFallbackMs = 30_000;

const userOwnedTables = [
  "blocks",
  "course_defaults",
  "events",
  "habit_logs",
  "habits",
  "items",
  "links",
  "notes",
  "planner_runs",
  "sat_mistakes",
  "sat_practice_tests",
  "sat_profiles",
  "sat_sessions",
  "sources",
] as const satisfies ReadonlyArray<keyof Database["public"]["Tables"]>;

export function LiveDataRefresh() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const refreshTimer = useRef<number | null>(null);

  const refreshVisiblePage = useCallback(() => {
    if (document.visibilityState !== "visible") return;

    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current);
    }

    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, refreshDebounceMs);
  }, [router]);

  useEffect(() => {
    let disposed = false;
    let fallbackTimer: number | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (disposed || !user) return;

      channel = supabase.channel(`dashboard-data:${user.id}`);

      for (const table of userOwnedTables) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `user_id=eq.${user.id}`,
          },
          refreshVisiblePage,
        );
      }

      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: `id=eq.${user.id}`,
        },
        refreshVisiblePage,
      );

      channel.subscribe();
      fallbackTimer = window.setInterval(refreshVisiblePage, refreshFallbackMs);
      window.addEventListener("focus", refreshVisiblePage);
      document.addEventListener("visibilitychange", refreshVisiblePage);
    }

    void subscribe();

    return () => {
      disposed = true;

      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      if (fallbackTimer !== null) {
        window.clearInterval(fallbackTimer);
      }
      if (channel !== null) {
        void supabase.removeChannel(channel);
      }

      window.removeEventListener("focus", refreshVisiblePage);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
    };
  }, [refreshVisiblePage, supabase]);

  return null;
}
