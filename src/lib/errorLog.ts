// Server side: writes an error to the app's own error log (sql/12_app_errors.sql)
// through log_app_error(), which anyone may call with bounded fields. Never
// throws — a failing error log must not turn into another error.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ErrorSource = "server" | "client";

export async function logAppError(source: ErrorSource, message: string, path = "", extra: { digest?: string; userAgent?: string } = {}): Promise<void> {
  console.error(`[${source} error] ${path} ${message}`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  try {
    const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await supabase.rpc("log_app_error", {
      error_source: source,
      error_message: message.slice(0, 500),
      error_path: path.slice(0, 300),
      error_digest: extra.digest?.slice(0, 100) ?? null,
      error_agent: extra.userAgent?.slice(0, 300) ?? null,
    });
  } catch {
    // no log table yet, or the database is unreachable: the console line above is all we get
  }
}

/** A path without its query string: the same error on /editor?book=a and ?book=b is one error. */
export function errorPath(path: string): string {
  return path.split("?")[0].slice(0, 300);
}
