"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * "line" (default): transparent fill, uniform stroke — the existing
 * coloring-book line-art look.
 * "silhouette": filled solid (used by ShadowMatchingBuilder's silhouette
 * column) — stroke is kept at the same color/weight too, not dropped,
 * because open-path source art (e.g. a stroke-only squiggle with no
 * closed area) would otherwise render as nothing once fill is the only
 * thing showing.
 */
export type SvgNormalizeMode = "line" | "silhouette";

export interface SvgNormalizerProps {
  /** A URL (remote or same-origin) or `data:` URI to fetch, or raw `"<svg>...</svg>"` markup to use as-is. */
  src: string;
  /** Desired PHYSICAL stroke weight, in points. */
  strokeWidthPt?: number;
  strokeColor?: string;
  mode?: SvgNormalizeMode;
  /** Fill color used when mode === "silhouette". */
  silhouetteColor?: string;
  /** Real-world size (inches) this art renders at — needed to keep stroke weight print-accurate regardless of the source SVG's internal viewBox scale (see the note in normalizeToLineArt below). */
  targetWidthIn: number;
  targetHeightIn: number;
  className?: string;
  style?: CSSProperties;
}

const SHAPE_TAGS = new Set(["path", "circle", "rect", "ellipse", "line", "polyline", "polygon"]);
const PT_PER_INCH = 72;

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; markup: string };

async function fetchSvgMarkup(src: string, signal: AbortSignal): Promise<string> {
  const trimmed = src.trim();
  if (trimmed.startsWith("<svg")) return trimmed;

  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error(`Failed to fetch SVG asset (HTTP ${response.status})`);
  return response.text();
}

/**
 * Rewrites every shape in an SVG document so it renders as a uniform
 * single-color version of itself — either "line" (transparent fill, a
 * single stroke color: the coloring-book look) or "silhouette" (filled
 * solid, stroke kept at the same color so open/stroke-only source paths
 * still show up rather than vanishing once fill is the only thing
 * rendered) — with a single PHYSICAL stroke width and rounded caps/joins,
 * regardless of whatever colors/fills/scale the source asset originally
 * used.
 *
 * Why scale matters: an imported SVG's `viewBox` is in arbitrary units (a
 * 400x400 icon and a 24x24 icon might both end up printed at 2in wide). A
 * raw `stroke-width="3"` written into each means something different in
 * each case once the browser scales the art to fit its target box. This
 * computes the source→target scale factor from the viewBox and
 * pre-compensates the stroke width so the *rendered* thickness always
 * equals `strokeWidthPt`, no matter the source art's internal scale.
 */
function normalizeSvg(
  svgMarkup: string,
  mode: SvgNormalizeMode,
  strokeWidthPt: number,
  strokeColor: string,
  silhouetteColor: string,
  targetWidthIn: number,
  targetHeightIn: number
): string {
  const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("Could not parse SVG markup");

  const root = doc.documentElement;

  // Force the art to fill whatever box it's placed in — never rely on the
  // browser's default intrinsic-size behavior for an <svg> with no
  // width/height attributes, which is inconsistent across engines.
  root.setAttribute("width", "100%");
  root.setAttribute("height", "100%");

  const viewBoxAttr = root.getAttribute("viewBox");
  const [, , vbWidth, vbHeight] = viewBoxAttr ? viewBoxAttr.split(/\s+/).map(Number) : [0, 0, targetWidthIn, targetHeightIn];
  const scale = vbWidth > 0 && vbHeight > 0 ? Math.min(targetWidthIn / vbWidth, targetHeightIn / vbHeight) : 1;
  const strokeWidthInSourceUnits = strokeWidthPt / PT_PER_INCH / scale;

  // Defensive: strip scripts before this markup is ever rendered via
  // dangerouslySetInnerHTML, even for a trusted authoring-tool asset.
  doc.querySelectorAll("script").forEach((node) => node.remove());

  doc.querySelectorAll("*").forEach((el) => {
    if (!SHAPE_TAGS.has(el.tagName.toLowerCase())) return;
    el.setAttribute("fill", mode === "silhouette" ? silhouetteColor : "none");
    el.setAttribute("stroke", mode === "silhouette" ? silhouetteColor : strokeColor);
    el.setAttribute("stroke-width", String(strokeWidthInSourceUnits));
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    // Inline `style` attributes take precedence over presentation
    // attributes in SVG, so a leftover `style="fill:red"` would silently
    // undo everything above unless it's stripped too.
    el.removeAttribute("style");
  });

  return new XMLSerializer().serializeToString(doc);
}

/**
 * Fetches an SVG asset (or accepts raw markup directly) and renders it as
 * normalized black-and-white line art. `fetch`/`DOMParser` are browser-only,
 * so loading happens in an effect — the component renders an empty,
 * deterministic placeholder until then rather than differing between the
 * server-rendered HTML and the client's first paint.
 */
export default function SvgNormalizer({
  src,
  strokeWidthPt = 3,
  strokeColor = "#000000",
  mode = "line",
  silhouetteColor = "#000000",
  targetWidthIn,
  targetHeightIn,
  className,
  style,
}: SvgNormalizerProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    // Reset to loading whenever the request identity (src or render
    // params) changes, so a stale "ready"/"error" state from the previous
    // src doesn't flash before the new fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" });

    fetchSvgMarkup(src, controller.signal)
      .then((raw) => normalizeSvg(raw, mode, strokeWidthPt, strokeColor, silhouetteColor, targetWidthIn, targetHeightIn))
      .then((markup) => {
        if (!controller.signal.aborted) setState({ status: "ready", markup });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return; // a newer request superseded this one; nothing to report
        setState({ status: "error", message: err instanceof Error ? err.message : "Failed to load SVG asset" });
      });

    return () => controller.abort();
  }, [src, mode, strokeWidthPt, strokeColor, silhouetteColor, targetWidthIn, targetHeightIn]);

  const sizedStyle: CSSProperties = { ...style, width: `${targetWidthIn}in`, height: `${targetHeightIn}in` };

  if (state.status === "error") {
    return (
      <div
        className={className}
        style={{ ...sizedStyle, display: "flex", alignItems: "center", justifyContent: "center" }}
        role="alert"
      >
        <span className="text-center text-[10px] leading-tight text-red-500">{state.message}</span>
      </div>
    );
  }

  if (state.status === "loading") {
    return <div className={className} style={sizedStyle} aria-busy="true" />;
  }

  return <div className={className} style={sizedStyle} dangerouslySetInnerHTML={{ __html: state.markup }} />;
}
