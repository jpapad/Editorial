// Auth callback — where Supabase sends the browser back to after:
//   - the Google OAuth round-trip (signInWithOAuth in src/app/login/page.tsx), and
//   - the sign-up confirmation email link (signUp's `emailRedirectTo`).
// Both arrive with a `code` query param (PKCE flow). An email template that
// links here with `token_hash` + `type` instead is handled too — that form
// works even when the link is opened in a different browser/device than the
// one that signed up, which a `code` link can't (its verifier cookie lives in
// the original browser). Exchanging either for a session has to happen
// server-side (it needs to set an httpOnly cookie), which is why this is a
// Route Handler and not something the login page itself can do.

import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code || (tokenHash && type)) {
    const supabase = await createServerSupabaseClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });
    if (!error) return NextResponse.redirect(`${origin}/studio`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
