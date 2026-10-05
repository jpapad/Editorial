// Refreshes the Supabase auth session cookie on every request. Named
// `proxy.ts` (not `middleware.ts`): Next.js 16 deprecated and renamed the
// `middleware` file convention to `proxy` (same mechanism, new name/export
// — see node_modules/next/dist/docs/.../proxy.md). This is the one server-
// side piece of the auth setup; the actual "redirect to /login" UX gating
// happens client-side in RequireAuth (see its own doc for why) — this file
// only keeps the cookie itself valid, it doesn't redirect on its own.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Reads (and, if expired, silently refreshes) the session — the actual
  // point of this file. The result is intentionally unused: this is only
  // here to keep the cookie fresh for whoever reads it next (RequireAuth,
  // the Supabase browser client), not to gate access itself.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline.html|icon.svg|icon-.*\\.png|apple-touch-icon.png).*)"],
};
