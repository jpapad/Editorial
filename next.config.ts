import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 builds with Turbopack by default. konva's Node-only
  // `canvas` backend lives behind the separate `konva/canvas-backend`
  // entry point (never imported by react-konva), so no bundler resolution
  // workaround is needed — this empty block just opts in to the default
  // Turbopack config explicitly so Next doesn't warn about a missing one.
  turbopack: {},
  // The service worker must never be served from a cache, or updates to it
  // would take days to reach installed apps.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
