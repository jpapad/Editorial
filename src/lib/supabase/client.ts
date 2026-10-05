// Browser client — used by client components: the login form, the
// session hook (src/lib/auth.ts), and utils/storage.ts's Supabase-backed
// read/write functions. Never import this from a Route Handler or
// middleware; those need the cookie-aware server client instead (see
// ./server.ts).

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.local.example to .env.local and fill in your Supabase project credentials."
  );
}

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
