// Decorative page frames for the Page panel's Frames picker and the
// "Border Frame" page template. Each frame is generated for the exact box
// it will fill (so corners never stretch on a portrait page) as black line
// art on transparent — colorable like everything else on the page.

export interface FrameDef {
  id: string;
  label: string;
  svg: (width: number, height: number) => string;
}

const wrap = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" stroke="black" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

/** `count` evenly spaced points along a rectangle's perimeter (inset by `inset`), starting at the top-left corner, clockwise. */
function perimeterPoints(w: number, h: number, inset: number, spacing: number): { x: number; y: number; side: number }[] {
  const iw = w - inset * 2;
  const ih = h - inset * 2;
  const sides = [
    { len: iw, at: (d: number) => ({ x: inset + d, y: inset }) },
    { len: ih, at: (d: number) => ({ x: w - inset, y: inset + d }) },
    { len: iw, at: (d: number) => ({ x: w - inset - d, y: h - inset }) },
    { len: ih, at: (d: number) => ({ x: inset, y: h - inset - d }) },
  ];
  const out: { x: number; y: number; side: number }[] = [];
  sides.forEach((s, side) => {
    const n = Math.max(1, Math.round(s.len / spacing));
    for (let i = 0; i < n; i++) out.push({ ...s.at((i * s.len) / n), side });
  });
  return out;
}

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" stroke-width="3" fill="white" />`;
}

function heartPath(cx: number, cy: number, s: number): string {
  return `<path d="M ${cx} ${cy + s * 0.9} C ${cx - s * 1.6} ${cy - s * 0.2}, ${cx - s * 0.7} ${cy - s * 1.3}, ${cx} ${cy - s * 0.45} C ${cx + s * 0.7} ${cy - s * 1.3}, ${cx + s * 1.6} ${cy - s * 0.2}, ${cx} ${cy + s * 0.9} Z" stroke-width="3" fill="white" />`;
}

export const FRAMES: FrameDef[] = [
  {
    id: "classic",
    label: "Classic",
    svg: (w, h) =>
      wrap(
        w,
        h,
        `<rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="20" stroke-width="8" />
         <rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="12" stroke-width="3" />
         <circle cx="8" cy="8" r="10" fill="black" /><circle cx="${w - 8}" cy="8" r="10" fill="black" />
         <circle cx="8" cy="${h - 8}" r="10" fill="black" /><circle cx="${w - 8}" cy="${h - 8}" r="10" fill="black" />`
      ),
  },
  {
    id: "simple",
    label: "Simple",
    svg: (w, h) => wrap(w, h, `<rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="14" stroke-width="6" />`),
  },
  {
    id: "dotted",
    label: "Dotted",
    svg: (w, h) =>
      wrap(
        w,
        h,
        `<rect x="18" y="18" width="${w - 36}" height="${h - 36}" rx="10" stroke-width="4" />` +
          perimeterPoints(w, h, 6, 22)
            .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="black" stroke="none" />`)
            .join("")
      ),
  },
  {
    id: "scallop",
    label: "Scallop",
    svg: (w, h) => {
      const r = 14;
      const bumps = perimeterPoints(w, h, r + 2, r * 2)
        .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" stroke-width="3" fill="white" />`)
        .join("");
      return wrap(w, h, `${bumps}<rect x="${r + 2}" y="${r + 2}" width="${w - 2 * (r + 2)}" height="${h - 2 * (r + 2)}" stroke-width="3" fill="white" />`);
    },
  },
  {
    id: "stars",
    label: "Stars",
    svg: (w, h) =>
      wrap(
        w,
        h,
        `<rect x="22" y="22" width="${w - 44}" height="${h - 44}" rx="8" stroke-width="3" />` +
          perimeterPoints(w, h, 22, 56)
            .map((p) => starPath(p.x, p.y, 14))
            .join("")
      ),
  },
  {
    id: "hearts",
    label: "Hearts",
    svg: (w, h) =>
      wrap(
        w,
        h,
        `<rect x="22" y="22" width="${w - 44}" height="${h - 44}" rx="16" stroke-width="3" />` +
          perimeterPoints(w, h, 22, 58)
            .map((p) => heartPath(p.x, p.y, 12))
            .join("")
      ),
  },
];

export function getFrame(id: string): FrameDef | undefined {
  return FRAMES.find((f) => f.id === id);
}

export function frameDataUri(frame: FrameDef, width: number, height: number): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(frame.svg(width, height))}`;
}
