// Hand-authored line art for the seed "Ocean" wizard topic. Real, matching
// illustrations only exist for these three letters — see contentProvider.ts
// for how the wizard handles every other letter honestly (a labeled
// placeholder, not mismatched or fabricated art).

export const OCTOPUS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <ellipse cx="200" cy="150" rx="110" ry="90" fill="none" stroke="black" stroke-width="6" />
  <circle cx="165" cy="140" r="10" fill="black" />
  <circle cx="235" cy="140" r="10" fill="black" />
  <path d="M170 175 Q200 195 230 175" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" />
  <path d="M110 210 Q80 260 100 310 Q110 340 90 370" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" />
  <path d="M145 230 Q120 280 140 330 Q150 355 125 380" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" />
  <path d="M180 240 Q170 295 190 340 Q195 360 175 385" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" />
  <path d="M220 240 Q230 295 210 340 Q205 360 225 385" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" />
  <path d="M255 230 Q280 280 260 330 Q250 355 275 380" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" />
  <path d="M290 210 Q320 260 300 310 Q290 340 310 370" fill="none" stroke="black" stroke-width="6" stroke-linecap="round" />
</svg>`.trim();

export const FISH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M20 50 Q35 25 65 32 Q85 37 92 50 Q85 63 65 68 Q35 75 20 50 Z" fill="none" stroke="black" stroke-width="4" />
  <path d="M20 50 L5 35 L5 65 Z" fill="none" stroke="black" stroke-width="4" stroke-linejoin="round" />
  <circle cx="68" cy="44" r="4" fill="black" />
</svg>`.trim();

export const STARFISH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M50 8 L61 38 L92 38 L67 57 L77 88 L50 68 L23 88 L33 57 L8 38 L39 38 Z" fill="none" stroke="black" stroke-width="4" stroke-linejoin="round" />
</svg>`.trim();
