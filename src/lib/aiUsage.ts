"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export interface AiUsage {
  used: number;
  /** null = unlimited (supervisors). */
  limit: number | null;
  /** Bought credits left (sql/09_billing.sql; absent before it runs). */
  extra?: number;
  plan?: string;
}

/** This month's AI credits. null until loaded, or when the usage migration isn't installed. */
export function useAiUsage() {
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const refresh = useCallback(() => {
    supabase.rpc("my_ai_usage").then(({ data, error }) => setUsage(error ? null : ((data as AiUsage | null) ?? null)));
  }, []);
  useEffect(() => refresh(), [refresh]);
  return { usage, refresh };
}
