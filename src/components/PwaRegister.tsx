"use client";

import { useEffect } from "react";

/** Registers public/sw.js in production builds (in dev it would cache Next's hot-reload chunks). */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}
