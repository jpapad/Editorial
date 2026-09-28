import type { ColorByNumberZone } from "@/types/kdpBook";

const SHAPE_TAGS = new Set(["path", "circle", "rect", "ellipse", "polygon"]);

/**
 * Tagging convention: a source SVG destined for Color-by-Number marks each
 * region an author wants numbered with `data-cbn-color="#rrggbb"` (the
 * suggested crayon color for that region) — e.g. in a design tool before
 * import, or hand-edited. Every shape sharing the same tagged color becomes
 * one numbered zone (so a shark's whole body can be tagged the same color
 * and get one number, even if it's drawn as several paths).
 *
 * Returns the cleaned, fill-none OUTLINE (what actually prints as the blank
 * page) plus the resolved zones (number + color + label position) — call
 * this once at authoring time and store both on the element; never at
 * render time.
 */
export function extractColorByNumberZones(
  svgMarkup: string,
  targetWidthIn: number,
  targetHeightIn: number
): { outlineSvgMarkup: string; zones: ColorByNumberZone[] } {
  if (typeof window === "undefined") {
    return { outlineSvgMarkup: svgMarkup, zones: [] };
  }

  const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  if (doc.querySelector("parsererror")) return { outlineSvgMarkup: svgMarkup, zones: [] };

  const root = doc.documentElement;
  root.setAttribute("width", "100%");
  root.setAttribute("height", "100%");

  const viewBox = root.getAttribute("viewBox");
  const [, , vbWidth, vbHeight] = viewBox ? viewBox.split(/\s+/).map(Number) : [0, 0, targetWidthIn, targetHeightIn];
  const scale = vbWidth > 0 && vbHeight > 0 ? Math.min(targetWidthIn / vbWidth, targetHeightIn / vbHeight) : 1;

  // getBBox() needs the element to be part of a rendered document, so the
  // parsed (detached) SVG is measured via a temporary hidden attachment.
  const measuringHost = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  measuringHost.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden");
  const importedRoot = document.importNode(root, true) as unknown as SVGSVGElement;
  measuringHost.appendChild(importedRoot);
  document.body.appendChild(measuringHost);

  const colorOrder: string[] = [];
  const boxesByColor = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();

  importedRoot.querySelectorAll("[data-cbn-color]").forEach((el) => {
    const color = el.getAttribute("data-cbn-color")!.toLowerCase();
    if (!colorOrder.includes(color)) colorOrder.push(color);

    const graphicsEl = el as unknown as SVGGraphicsElement;
    const bbox = graphicsEl.getBBox ? graphicsEl.getBBox() : { x: 0, y: 0, width: 0, height: 0 };
    const box = boxesByColor.get(color);
    const minX = bbox.x, minY = bbox.y, maxX = bbox.x + bbox.width, maxY = bbox.y + bbox.height;
    boxesByColor.set(
      color,
      box
        ? { minX: Math.min(box.minX, minX), minY: Math.min(box.minY, minY), maxX: Math.max(box.maxX, maxX), maxY: Math.max(box.maxY, maxY) }
        : { minX, minY, maxX, maxY }
    );
  });

  document.body.removeChild(measuringHost);

  const zones: ColorByNumberZone[] = colorOrder.map((color, i) => {
    const box = boxesByColor.get(color)!;
    const centerXSourceUnits = (box.minX + box.maxX) / 2;
    const centerYSourceUnits = (box.minY + box.maxY) / 2;
    return {
      id: `zone-${i + 1}`,
      number: i + 1,
      colorHex: color,
      labelX: centerXSourceUnits * scale,
      labelY: centerYSourceUnits * scale,
    };
  });

  // Defensive: strip scripts before this markup is ever rendered via dangerouslySetInnerHTML.
  doc.querySelectorAll("script").forEach((node) => node.remove());

  doc.querySelectorAll("*").forEach((el) => {
    if (!SHAPE_TAGS.has(el.tagName.toLowerCase())) return;
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "#000000");
    el.setAttribute("stroke-width", String(1.5 / scale)); // ~1.5pt physical, same compensation approach as SvgNormalizer
    el.setAttribute("stroke-linejoin", "round");
    el.removeAttribute("style");
    el.removeAttribute("data-cbn-color");
  });

  return { outlineSvgMarkup: new XMLSerializer().serializeToString(doc), zones };
}
