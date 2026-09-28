"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { inchesToPx, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";

export interface NormalizeOptions {
  /** Desired PHYSICAL stroke weight, in points (pt) — see the file header comment for why this can't just be a raw number. */
  strokeWeightPt?: number;
  strokeColor?: string; // hex
  /** The real-world size (inches) this art will be rendered/printed at — needed to counteract the source SVG's own viewBox scale so strokeWeightPt means the same physical thickness for every asset. */
  targetWidthIn: number;
  targetHeightIn: number;
}

const SHAPE_TAGS = new Set(["path", "circle", "rect", "ellipse", "line", "polyline", "polygon"]);
const PT_PER_INCH = 72;

/**
 * Rewrites every shape in an SVG document so it renders as uniform
 * black-and-white line art: transparent fill, a single stroke color, and a
 * single PHYSICAL stroke width — regardless of whatever colors/fills/scale
 * the source asset originally used.
 *
 * Why scale matters: an imported SVG's `viewBox` is in arbitrary units (a
 * 400x400 icon and a 24x24 icon might both end up printed at 2 inches
 * wide). A raw `stroke-width="3"` written into each means something totally
 * different in each case once the browser scales the art to fit its target
 * box. This computes the source→target scale factor from the viewBox and
 * pre-compensates the stroke width so the *final rendered* thickness always
 * equals `strokeWeightPt`, regardless of the source art's internal scale —
 * which is what makes the Pre-Flight Checker's "< 0.75pt" rule meaningful
 * for imported art at all.
 */
export function normalizeSvgToLineArt(svgMarkup: string, options: NormalizeOptions): string {
  if (typeof window === "undefined") return svgMarkup;

  const strokeWeightPt = options.strokeWeightPt ?? 3;
  const strokeColor = options.strokeColor ?? "#000000";

  const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  if (doc.querySelector("parsererror")) return svgMarkup;

  const root = doc.documentElement;

  // Force the art to fill whatever box it's placed in — never rely on the
  // browser's default intrinsic-size behavior for an <svg> with no
  // width/height attributes, which varies and is easy to get wrong.
  root.setAttribute("width", "100%");
  root.setAttribute("height", "100%");

  const viewBox = root.getAttribute("viewBox");
  const [, , vbWidth, vbHeight] = viewBox ? viewBox.split(/\s+/).map(Number) : [0, 0, options.targetWidthIn, options.targetHeightIn];
  const scale =
    vbWidth > 0 && vbHeight > 0
      ? Math.min(options.targetWidthIn / vbWidth, options.targetHeightIn / vbHeight)
      : 1;
  const strokeWidthInSourceUnits = scale > 0 ? strokeWeightPt / PT_PER_INCH / scale : strokeWeightPt / PT_PER_INCH;

  // Defensive: never carry scripts through into content we're about to
  // render via dangerouslySetInnerHTML, even though this is author-supplied
  // art in an authoring tool rather than arbitrary third-party input.
  doc.querySelectorAll("script").forEach((node) => node.remove());

  doc.querySelectorAll("*").forEach((el) => {
    if (!SHAPE_TAGS.has(el.tagName.toLowerCase())) return;
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", strokeColor);
    el.setAttribute("stroke-width", String(strokeWidthInSourceUnits));
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    // Inline `style` attributes take precedence over presentation
    // attributes in SVG, so a leftover `style="fill:red"` would silently
    // undo everything above unless we strip it too.
    el.removeAttribute("style");
  });

  return new XMLSerializer().serializeToString(doc);
}

interface SvgNormalizerProps {
  svgMarkup: string;
  strokeWeightPt?: number;
  strokeColor?: string;
  targetWidthIn: number;
  targetHeightIn: number;
  pxPerInch?: number;
  /** Positioning only (e.g. `position: absolute; left; top`) — sizing comes from targetWidthIn/targetHeightIn. */
  style?: CSSProperties;
  className?: string;
}

/**
 * React wrapper around normalizeSvgToLineArt(). Renders empty until after
 * mount, then fills in the normalized markup — DOMParser doesn't exist
 * during server rendering, and computing it eagerly would make the client's
 * first render disagree with the server-rendered HTML (a hydration
 * mismatch). Deferring to an effect keeps both passes identical.
 */
export default function SvgNormalizer({
  svgMarkup,
  strokeWeightPt,
  strokeColor,
  targetWidthIn,
  targetHeightIn,
  pxPerInch = SCREEN_PX_PER_INCH,
  style,
  className,
}: SvgNormalizerProps) {
  const [cleaned, setCleaned] = useState<string | null>(null);

  useEffect(() => {
    // Deliberate: this is the standard "differs between server and client"
    // pattern (render a deterministic placeholder, fill in the real value
    // after mount) — DOMParser doesn't exist during SSR, so there's no way
    // to compute this value there at all.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCleaned(normalizeSvgToLineArt(svgMarkup, { strokeWeightPt, strokeColor, targetWidthIn, targetHeightIn }));
  }, [svgMarkup, strokeWeightPt, strokeColor, targetWidthIn, targetHeightIn]);

  const sizedStyle: CSSProperties = {
    ...style,
    width: inchesToPx(targetWidthIn, pxPerInch),
    height: inchesToPx(targetHeightIn, pxPerInch),
  };

  if (cleaned === null) {
    return <div className={className} style={sizedStyle} />;
  }

  return <div className={className} style={sizedStyle} dangerouslySetInnerHTML={{ __html: cleaned }} />;
}
