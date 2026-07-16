import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";

const adminEnvironmentSchema = z.object({
  url: z.url(),
  serviceRoleKey: z.string().min(1),
});

export function createAdminClient() {
  const environment = adminEnvironmentSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!environment.success) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createSupabaseClient<Database>(
    environment.data.url,
    environment.data.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
