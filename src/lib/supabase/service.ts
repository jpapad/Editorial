// Service-role client — bypasses RLS. Server only, and only for writes no
// user may make for themselves: the Stripe webhook recording a plan or
// bought credits. Reads SUPABASE_SERVICE_ROLE_KEY (Project Settings > API),
// which must never reach the browser (no NEXT_PUBLIC_ prefix).

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — the payment webhook can't record purchases without it.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
