"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth";
import s from "./login.module.css";
import { LanguageToggle, useT } from "@/lib/i18n";

type Mode = "sign-in" | "sign-up";
type Status = "idle" | "loading" | "signed-in" | "check-email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SIGNUP_PASSWORD = 8;

/** Where Supabase sends the browser back to after Google OAuth or the sign-up confirmation link — whatever origin the app is running on (localhost in dev, the real domain in prod). Must also be listed under Supabase > Authentication > URL Configuration > Redirect URLs. */
function callbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

/** Real login/signup — email+password (Supabase Auth) plus Google OAuth, styled after the "Pagewright — Sign in & Sign up" design. Already-signed-in visitors get bounced straight to /studio rather than seeing the form again. */
// useSearchParams needs a Suspense boundary or `next build` bails out of
// prerendering this page.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const t = useT();
  // /auth/callback bounces here with ?error=auth_callback_failed when the
  // confirmation or OAuth link couldn't be turned into a session.
  const callbackFailed = useSearchParams().get("error") === "auth_callback_failed";

  useEffect(() => {
    if (!sessionLoading && user) router.replace("/studio");
  }, [sessionLoading, user, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setStatus("idle");
    setFormError(null);
    setEmailError(null);
    setPasswordError(null);
    setResent(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    const trimmed = email.trim();
    let eErr: string | null = null;
    let pErr: string | null = null;
    if (!trimmed) eErr = "Enter your email address.";
    else if (!EMAIL_RE.test(trimmed)) eErr = "That doesn't look like an email address.";
    if (!password) pErr = mode === "sign-up" ? "Choose a password." : "Enter your password.";
    else if (mode === "sign-up" && password.length < MIN_SIGNUP_PASSWORD) pErr = "Use at least {n} characters.";

    setEmailError(eErr);
    setPasswordError(pErr);
    setFormError(null);
    if (eErr || pErr) return;

    setStatus("loading");
    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email: trimmed, password })
        : await supabase.auth.signUp({ email: trimmed, password, options: { emailRedirectTo: callbackUrl() } });

    if (authError) {
      setStatus("idle");
      setFormError(
        authError.message === "Invalid login credentials"
          ? "That email and password don't match. Try again, or create an account."
          : authError.message,
      );
      return;
    }
    if (mode === "sign-up") {
      // Depending on the Supabase project's "Confirm email" setting, signUp
      // either returns an active session immediately (useSession then
      // redirects) or requires the user to click a confirmation link first.
      setStatus("check-email");
      return;
    }
    setStatus("signed-in");
    router.replace("/studio");
  }

  async function handleGoogle() {
    setFormError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (authError) setFormError(authError.message);
    // On success the browser navigates away to Google — nothing left to do here.
  }

  async function handleResend() {
    const { error: authError } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: callbackUrl() } });
    if (authError) {
      setFormError(authError.message);
      return;
    }
    setResent(true);
  }

  const isSignup = mode === "sign-up";
  const isLoading = status === "loading";
  const passwordInvalid = !!passwordError;

  return (
    <main className={s.page}>
      <LanguageToggle className="fixed right-4 top-4 z-10" />
      <IllustrationPanel />

      <div className={s.mobileTop}>
        <Brand />
      </div>
      <div className={s.mobilePanel} aria-hidden="true">
        <span className={clsx(s.mono, s.mobilePanelKicker)}>{t("Coloring book editor")}</span>
        <p className={s.mobilePanelTitle}>{t("Your line art, ready for print.")}</p>
        <div className={s.miniPage}>
          <FlowerArt width={68} height={82} strokeWidth={6} simple />
        </div>
      </div>

      <div className={s.formSide}>
        <div className={clsx(s.card, status === "check-email" && s.cardSuccess)}>
          {status === "check-email" ? (
            <div className={s.success}>
              <div className={s.mailMark}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#141416" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M4 7.5l8 5.5 8-5.5" />
                </svg>
              </div>
              <div className={s.successCopy}>
                <span className={clsx(s.mono, s.eyebrow)}>{t("One more step")}</span>
                <h1 className={s.title}>{t("Check your email")}</h1>
                <p role="status">
                  {t("We sent a confirmation link to")} <strong>{email.trim() || t("your inbox")}</strong>. {t("Open it to activate your account.")}
                </p>
              </div>
              {formError && <FormAlert message={formError} />}
              <button type="button" className={s.ghost} onClick={handleResend} disabled={resent}>
                {resent ? (
                  <>
                    <CheckIcon stroke="#1A6340" />
                    <span>{t("Sent again")}</span>
                  </>
                ) : (
                  <span>{t("Resend email")}</span>
                )}
              </button>
              <p className={s.switch}>
                {t("Wrong address?")}{" "}
                <button type="button" className={s.link} onClick={() => switchMode("sign-up")}>
                  {t("Use another email")}
                </button>
              </p>
              <p className={s.switch}>
                <button type="button" className={s.link} onClick={() => switchMode("sign-in")}>
                  {t("Back to sign in")}
                </button>
              </p>
            </div>
          ) : (
            <div className={s.stack}>
              <div className={s.seg}>
                <div className={clsx(s.segThumb, isSignup && s.segThumbRight)} />
                <button type="button" className={s.segBtn} aria-pressed={!isSignup} onClick={() => switchMode("sign-in")}>
                  {t("Sign in")}
                </button>
                <button type="button" className={s.segBtn} aria-pressed={isSignup} onClick={() => switchMode("sign-up")}>
                  {t("Create account")}
                </button>
              </div>

              <div className={s.heading}>
                <h1 className={s.title}>{isSignup ? t("Create your account") : t("Welcome back")}</h1>
                <p className={s.sub}>{isSignup ? t("Set up your studio and start your first book.") : t("Sign in to pick up where you left off.")}</p>
              </div>

              <form onSubmit={handleSubmit} className={s.form} noValidate>
                {formError ? (
                  <FormAlert message={formError} />
                ) : (
                  callbackFailed && <FormAlert message="That link didn't work — it may have expired or been opened in a different browser. Sign in, or request a new one." />
                )}
                {status === "signed-in" && (
                  <div className={s.notice} role="status">
                    <CheckIcon />
                    <span>{t("You're signed in. Opening your studio…")}</span>
                  </div>
                )}

                <div className={s.fieldGroup}>
                  <label htmlFor="pw-email" className={s.label}>
                    {t("Email")}
                  </label>
                  <div className={clsx(s.field, emailError && s.fieldError)}>
                    <input
                      id="pw-email"
                      className={s.input}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@yourstudio.com"
                      value={email}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? "pw-email-error" : undefined}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError(null);
                        setFormError(null);
                      }}
                    />
                  </div>
                  {emailError && <FieldError id="pw-email-error" message={emailError} />}
                </div>

                <div className={s.fieldGroup}>
                  <label htmlFor="pw-password" className={s.label}>
                    {t("Password")}
                  </label>
                  <div className={clsx(s.field, passwordInvalid && s.fieldError)}>
                    <input
                      id="pw-password"
                      className={s.input}
                      type={showPassword ? "text" : "password"}
                      autoComplete={isSignup ? "new-password" : "current-password"}
                      placeholder="••••••••"
                      value={password}
                      aria-invalid={passwordInvalid}
                      aria-describedby={passwordError ? "pw-password-error" : isSignup ? "pw-password-hint" : undefined}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError(null);
                        setFormError(null);
                      }}
                    />
                    <button
                      type="button"
                      className={s.iconBtn}
                      aria-label={showPassword ? t("Hide password") : t("Show password")}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {passwordError ? (
                    <FieldError id="pw-password-error" message={passwordError} />
                  ) : (
                    isSignup && (
                      <span id="pw-password-hint" className={s.hint}>
                        {t("Use {n} or more characters.", { n: MIN_SIGNUP_PASSWORD })}
                      </span>
                    )
                  )}
                </div>

                <button type="submit" className={s.primary} disabled={isLoading || status === "signed-in"}>
                  {isLoading ? (
                    <>
                      <span className={s.spinner} />
                      <span>{t("One moment…")}</span>
                    </>
                  ) : status === "signed-in" ? (
                    <>
                      <CheckIcon />
                      <span>{t("Signed in")}</span>
                    </>
                  ) : (
                    <>
                      <span>{isSignup ? t("Create account") : t("Sign in")}</span>
                      <svg className={s.arrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <div className={clsx(s.mono, s.divider)}>{t("or")}</div>

              <div className={s.bottom}>
                <button type="button" className={s.ghost} onClick={handleGoogle}>
                  <span className={s.googleMark} aria-hidden="true">
                    G
                  </span>
                  <span>{t("Continue with Google")}</span>
                </button>
                <p className={s.switch}>
                  {isSignup ? t("Already have an account?") : t("Don't have an account?")}{" "}
                  <button type="button" className={s.link} onClick={() => switchMode(isSignup ? "sign-in" : "sign-up")}>
                    {isSignup ? t("Sign in") : t("Create one")}
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>

        <span className={clsx(s.mono, s.footer)}>© {new Date().getFullYear()} Pagewright</span>
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className={s.brand}>
      <div className={s.brandMark}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6.5 3.5h8l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-11a1.5 1.5 0 0 1-1.5-1.5v-14a1.5 1.5 0 0 1 1.5-1.5z" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M14.5 3.5V8H19" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="11" cy="14" r="3.3" className={s.fAcc} />
        </svg>
      </div>
      <span className={s.brandName}>Pagewright</span>
    </div>
  );
}

function IllustrationPanel() {
  const t = useT();
  return (
    <aside className={s.panel}>
      <div className={s.panelTop}>
        <Brand />
        <span className={clsx(s.mono, s.badge)}>{t("For KDP creators")}</span>
      </div>

      <div className={s.stage} aria-hidden="true">
        <div className={s.pageBack} />
        <div className={s.pageFront}>
          <FlowerArt width={286} height={343} strokeWidth={2.5} />
          <div className={clsx(s.mono, s.pageMeta)}>
            <span>{t("Page")} 07</span>
            <span>8.5 × 11 in</span>
          </div>
        </div>
        <div className={clsx(s.chip, s.chipPdf)}>
          <span className={s.chipCheck}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <span>{t("Print-ready PDF")}</span>
        </div>
        <div className={clsx(s.chip, s.mono, s.chipBleed)}>
          <span>{t("Bleed")}</span>
          <span className={s.chipRule} />
          <span style={{ fontWeight: 500, color: "#141416" }}>0.125 in</span>
        </div>
      </div>

      <div className={s.panelCopy}>
        <h2 className={s.panelTitle}>{t("Your line art, ready for print.")}</h2>
        <p className={s.panelLede}>{t("Design pages, arrange your book and export print-ready interiors for Amazon KDP.")}</p>
      </div>
    </aside>
  );
}

const PETAL_FILLS = ["fAcc", "fW", "fTint", "fW", "fAcc", "fW", "fW", "fTint"] as const;

/** The line-art flower page from the design; `simple` drops the ground line, details and sparkles for the small mobile thumbnail. */
function FlowerArt({ width, height, strokeWidth, simple = false }: { width: number; height: number; strokeWidth: number; simple?: boolean }) {
  return (
    <svg viewBox="0 0 400 480" width={width} height={height} fill="none" stroke="#141416" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {!simple && <path d="M40 450 Q120 430 200 450 T360 450" />}
      <path d="M200 236 C194 300 208 370 200 450" />
      <path className={s.fTint} d="M199 340 C162 312 128 318 110 346 C146 368 180 364 199 340 Z" />
      {!simple && <path d="M126 346 Q164 344 196 341" />}
      <path className={s.fW} d="M202 386 C238 358 272 364 290 390 C256 412 222 408 202 386 Z" />
      {!simple && <path d="M220 388 Q252 386 276 390" />}
      {PETAL_FILLS.map((fill, i) => (
        <g key={i} transform={`rotate(${i * 45} 200 190)`}>
          <ellipse className={s[fill]} cx="200" cy="132" rx="24" ry="46" />
        </g>
      ))}
      <circle className={s.fSoft} cx="200" cy="190" r="30" />
      {!simple && (
        <>
          <circle cx="191" cy="181" r="3" fill="#141416" stroke="none" />
          <circle cx="209" cy="183" r="3" fill="#141416" stroke="none" />
          <circle cx="200" cy="197" r="3" fill="#141416" stroke="none" />
          <circle cx="188" cy="198" r="2.4" fill="#141416" stroke="none" />
          <circle cx="212" cy="199" r="2.4" fill="#141416" stroke="none" />
          {[0, 72, 144, 216, 288].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 84 108)`}>
              <ellipse className={s.fW} cx="84" cy="90" rx="8" ry="14" />
            </g>
          ))}
          <circle className={s.fAcc} cx="84" cy="108" r="7" />
          <path d="M330 62 v22 M319 73 h22" />
          <path d="M62 290 v16 M54 298 h16" />
          <path d="M340 290 v18 M331 299 h18" />
          <circle className={s.fW} cx="318" cy="200" r="10" />
        </>
      )}
    </svg>
  );
}

/** `message` is an English i18n key (or a raw server message, which passes through unchanged). */
function FormAlert({ message }: { message: string }) {
  const t = useT();
  return (
    <div className={s.alert} role="alert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
      <span>{t(message)}</span>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  const t = useT();
  return (
    <span id={id} className={s.fieldMsg}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
      {t(message, { n: MIN_SIGNUP_PASSWORD })}
    </span>
  );
}

function CheckIcon({ stroke = "currentColor" }: { stroke?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17.3 17.3 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
