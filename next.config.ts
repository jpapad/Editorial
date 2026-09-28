import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 builds with Turbopack by default. konva's Node-only
  // `canvas` backend lives behind the separate `konva/canvas-backend`
  // entry point (never imported by react-konva), so no bundler resolution
  // workaround is needed — this empty block just opts in to the default
  // Turbopack config explicitly so Next doesn't warn about a missing one.
  turbopack: {},
};

export default nextConfig;
