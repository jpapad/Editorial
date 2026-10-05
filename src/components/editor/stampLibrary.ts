// Built-in black-outline SVG line art, sized to a common 200x200 viewBox so
// every stamp drops onto the canvas at a predictable, consistent aspect
// ratio. Kids color these in after they're placed, so fills stay white/none
// on purpose. Shared between the Sidebar's stamp picker and the page-template
// factory (the "Border Frame" template reuses the Frame art directly).

export const STAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M100 10 L123 78 L195 78 L137 118 L160 190 L100 145 L40 190 L63 118 L5 78 L77 78 Z"
    fill="white" stroke="black" stroke-width="6" stroke-linejoin="round" />
</svg>`.trim();

export const HEART_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M100 180 C40 130 10 90 10 55 C10 25 35 5 60 5 C80 5 95 15 100 35 C105 15 120 5 140 5 C165 5 190 25 190 55 C190 90 160 130 100 180 Z"
    fill="white" stroke="black" stroke-width="6" stroke-linejoin="round" />
</svg>`.trim();

export const ANIMAL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <path d="M55 55 L30 15 L75 40 Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round" />
  <path d="M145 55 L170 15 L125 40 Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round" />
  <circle cx="100" cy="110" r="75" fill="white" stroke="black" stroke-width="6" />
  <circle cx="72" cy="100" r="8" fill="black" />
  <circle cx="128" cy="100" r="8" fill="black" />
  <path d="M100 120 L92 132 L108 132 Z" fill="black" />
  <path d="M40 145 L80 140 M160 145 L120 140 M40 160 L80 150 M160 160 L120 150" stroke="black" stroke-width="4" stroke-linecap="round" />
</svg>`.trim();

export const FRAME_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="10" y="10" width="180" height="180" rx="14" fill="none" stroke="black" stroke-width="6" />
  <rect x="26" y="26" width="148" height="148" rx="8" fill="none" stroke="black" stroke-width="4" />
  <circle cx="10" cy="10" r="7" fill="black" />
  <circle cx="190" cy="10" r="7" fill="black" />
  <circle cx="10" cy="190" r="7" fill="black" />
  <circle cx="190" cy="190" r="7" fill="black" />
</svg>`.trim();

export interface StampAsset {
  id: string;
  label: string;
  svg: string;
}

export const STAMP_LIBRARY: StampAsset[] = [
  { id: "star", label: "Star", svg: STAR_SVG },
  { id: "heart", label: "Heart", svg: HEART_SVG },
  { id: "animal", label: "Animal", svg: ANIMAL_SVG },
  { id: "frame", label: "Frame", svg: FRAME_SVG },
];

export function svgToDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
