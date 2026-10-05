"use client";

// Where to go after signing in: a page that needed an account (an invite
// link, say) remembers itself before sending the user to /login, and the
// first signed-in page picks it up. Same-site paths only.

const KEY = "pagewright-return-to";

export function rememberReturnTo(path: string) {
  try {
    if (path.startsWith("/") && !path.startsWith("//")) sessionStorage.setItem(KEY, path);
  } catch {
    // no storage: the user lands on the library instead
  }
}

/** The remembered path (once — it's forgotten as it's read), or null. */
export function takeReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && path.startsWith("/") && !path.startsWith("//") ? path : null;
  } catch {
    return null;
  }
}
