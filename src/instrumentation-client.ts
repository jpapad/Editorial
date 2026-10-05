// Browser errors → /api/log-error → the app's error log (sql/12_app_errors.sql).
// Production only (in development the error overlay is the place to look);
// a test can opt in with localStorage "pagewright-report-errors" = "1".
// At most a few reports per page load, each distinct message once.

const MAX_REPORTS = 5;
const sent = new Set<string>();

function enabled(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  try {
    return localStorage.getItem("pagewright-report-errors") === "1";
  } catch {
    return false;
  }
}

function report(message: string) {
  try {
    if (!message || sent.has(message) || sent.size >= MAX_REPORTS || !enabled()) return;
    // Noise from browser extensions and cancelled loads, not our bugs.
    if (/ResizeObserver loop|extension:\/\/|AbortError|Script error\.?$/i.test(message)) return;
    sent.add(message);
    const body = JSON.stringify({ message: message.slice(0, 500), path: window.location.pathname });
    void fetch("/api/log-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  } catch {
    // reporting must never break the page
  }
}

window.addEventListener("error", (event) => {
  const err = event.error as Error | undefined;
  report(err ? `${err.name}: ${err.message}` : event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason as unknown;
  report(reason instanceof Error ? `${reason.name}: ${reason.message}` : `Unhandled rejection: ${String(reason)}`);
});
