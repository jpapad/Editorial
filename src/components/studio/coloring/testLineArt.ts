// A minimal fixture proving the tap-to-flood-fill interaction actually
// works on real vector regions — NOT production content. The handoff's
// fidelity rule treats all real artwork as an unbuilt image slot (striped
// placeholder); this exists only because "tap a region to flood-fill" is
// the screen's one defining interaction, and there is nothing to click
// inside a plain striped pattern. Same reasoning as AutoDotToDot's test
// star shape earlier in this project — a small, clearly-labeled test
// fixture for proving a mechanism, not fabricated book content.
//
// Two-layer shape per the README's Color behavior: these are the FILL
// regions (locked line art renders separately, on top, pointer-events
// none, so a tap passes through the outline to the region beneath it).

export interface FillableRegion {
  id: string;
  /** SVG path/shape element type + attributes, kept generic enough to cover both circle and path without a discriminated union nobody else needs. */
  element: "path" | "ellipse";
  attrs: Record<string, string | number>;
}

export const TEST_LINE_ART_VIEWBOX = "0 0 300 300";

export const TEST_FILL_REGIONS: FillableRegion[] = [
  { id: "tail", element: "path", attrs: { d: "M215 190 C 270 170, 280 220, 240 240 C 210 255, 195 220, 215 190 Z" } },
  { id: "body", element: "ellipse", attrs: { cx: 150, cy: 195, rx: 85, ry: 55 } },
  { id: "head", element: "ellipse", attrs: { cx: 78, cy: 150, rx: 42, ry: 40 } },
  { id: "ear", element: "path", attrs: { d: "M55 115 L45 78 L82 105 Z" } },
  { id: "belly", element: "ellipse", attrs: { cx: 150, cy: 205, rx: 40, ry: 28 } },
];

/** Same shapes' outlines, stroke-only — the always-locked line-art layer that renders on top. */
export const TEST_LINE_ART_OUTLINE = `
<path d="M215 190 C 270 170, 280 220, 240 240 C 210 255, 195 220, 215 190 Z" fill="none" stroke="#10141a" stroke-width="3" stroke-linejoin="round" />
<ellipse cx="150" cy="195" rx="85" ry="55" fill="none" stroke="#10141a" stroke-width="3" />
<ellipse cx="78" cy="150" rx="42" ry="40" fill="none" stroke="#10141a" stroke-width="3" />
<path d="M55 115 L45 78 L82 105 Z" fill="none" stroke="#10141a" stroke-width="3" stroke-linejoin="round" />
<ellipse cx="150" cy="205" rx="40" ry="28" fill="none" stroke="#10141a" stroke-width="2" stroke-dasharray="4 4" />
<circle cx="62" cy="145" r="3" fill="#10141a" />
`.trim();
