// Preset repeating background patterns. Each is a small SVG tile — Konva
// fills the whole page by repeating it via `fillPatternImage`, so these only
// need to define one tile's worth of motif, not the full page.

export interface BackgroundPattern {
  id: string;
  label: string;
  tileSize: number;
  svg: string;
}

const STROKE = "#cbd5e1"; // slate-300 — light enough to stay behind hand-drawn ink

export const BACKGROUND_PATTERNS: BackgroundPattern[] = [
  {
    id: "stars",
    label: "Stars",
    tileSize: 60,
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <path d="M15 4 L18 12 L27 12 L20 17 L22 25 L15 20 L8 25 L10 17 L3 12 L12 12 Z" fill="none" stroke="${STROKE}" stroke-width="2" />
  <path d="M45 34 L48 42 L57 42 L50 47 L52 55 L45 50 L38 55 L40 47 L33 42 L42 42 Z" fill="none" stroke="${STROKE}" stroke-width="2" />
</svg>`.trim(),
  },
  {
    id: "dots",
    label: "Dots",
    tileSize: 40,
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <circle cx="10" cy="10" r="4" fill="${STROKE}" />
  <circle cx="30" cy="30" r="4" fill="${STROKE}" />
</svg>`.trim(),
  },
  {
    id: "clouds",
    label: "Clouds",
    tileSize: 80,
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <path d="M14 40 a8 8 0 0 1 4-15 a10 10 0 0 1 19-4 a8 8 0 0 1 9 12 a7 7 0 0 1 -2 14 h-24 a7 7 0 0 1 -6-7 Z"
    fill="none" stroke="${STROKE}" stroke-width="2" stroke-linejoin="round" />
</svg>`.trim(),
  },
  {
    id: "hearts",
    label: "Hearts",
    tileSize: 60,
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
  <path d="M30 46 C14 36 6 27 6 18 C6 11 11 6 18 6 C23 6 27 9 30 14 C33 9 37 6 42 6 C49 6 54 11 54 18 C54 27 46 36 30 46 Z"
    fill="none" stroke="${STROKE}" stroke-width="2.5" stroke-linejoin="round" />
</svg>`.trim(),
  },
  {
    id: "geometric",
    label: "Geometric",
    tileSize: 50,
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
  <polygon points="25,4 46,25 25,46 4,25" fill="none" stroke="${STROKE}" stroke-width="2" />
  <circle cx="25" cy="25" r="6" fill="none" stroke="${STROKE}" stroke-width="2" />
</svg>`.trim(),
  },
];

export function svgToDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getBackgroundPattern(id: string | null | undefined): BackgroundPattern | undefined {
  if (!id) return undefined;
  return BACKGROUND_PATTERNS.find((p) => p.id === id);
}
