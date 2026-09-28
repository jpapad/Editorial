// Server-side AI credit checks for the AI API routes (Node only — uses the
// cookie-aware Supabase client). The limit is enforced here, before any
// provider is called, so it can't be skipped from the browser.

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CreditKind = "ai_image" | "ai_photo";

export type CreditGrant =
  | { ok: true; used: number | null; limit: number | null; refund: (units?: number) => Promise<void> }
  | { ok: false; status: 401 | 429; error: string; used?: number; limit?: number | null };

/** "function … does not exist" — the usage migration hasn't been run; see below. */
function isMissingFunction(message: string): boolean {
  return /consume_ai_credit|refund_ai_credit/.test(message) && /(does not exist|Could not find|schema cache)/i.test(message);
}

/**
 * Reserves `units` credits for the signed-in user. Returns a refund() for
 * credits that end up not producing an image. Until the usage migration
 * (20260928160000) has been run there's no limit to check: that case is
 * allowed through and logged, so AI keeps working on a fresh project.
 */
export async function reserveCredits(kind: CreditKind, units: number): Promise<CreditGrant> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, status: 401, error: "Sign in to use AI features." };

  const { data, error } = await supabase.rpc("consume_ai_credit", { credit_kind: kind, credit_units: units });
  if (error) {
    if (isMissingFunction(error.message)) {
      console.warn("[aiCredits] usage migration not run — AI limits are not being enforced.");
      return { ok: true, used: null, limit: null, refund: async () => {} };
    }
    throw new Error(error.message);
  }
  const result = data as { allowed: boolean; used: number; limit: number | null; event_id?: number };
  if (!result.allowed) {
    return { ok: false, status: 429, error: `Monthly AI limit reached (${result.used} of ${result.limit} used). It resets on the 1st.`, used: result.used, limit: result.limit };
  }
  return {
    ok: true,
    used: result.used,
    limit: result.limit,
    refund: async (refundUnits?: number) => {
      if (!result.event_id || refundUnits === 0) return;
      const { error: refundError } = await supabase.rpc("refund_ai_credit", { credit_event: result.event_id, refund_units: refundUnits ?? null });
      if (refundError) console.error("[aiCredits] refund failed:", refundError.message);
    },
  };
}
