// SVG path simplification — Sprint 6.
//
// Pure string/math, no DOMParser dependency — works identically in the
// browser and in pdfExporter.ts's Node environment (unlike SvgNormalizer,
// which needs a real DOMParser and so has a separate Node-side twin — see
// pdfExporter.ts's normalizeSvgForPdf comment). optimizeSvgMarkup() below
// finds `d="..."` attributes with a regex instead of parsing the document,
// which is why no DOM API is needed at all.
//
// Scope, stated up front: this only reduces redundant points on STRAIGHT-
// LINE subpaths (M/L/H/V/Z) — the case that actually produces bloated
// path data in practice (e.g. line art hand-traced or exported as a dense
// polyline). Any subpath containing a curve command (C/S/Q/T/A) is passed
// through completely unmodified. Safely "simplifying" a bezier curve means
// re-fitting it with fewer control points, not dropping points from it —
// that's curve-fitting, a different (and much larger) algorithm than
// Douglas-Peucker, and out of scope here. Mixing the two — say, dropping
// points from a curve's flattened approximation — would visibly distort
// the curve, which is worse than doing nothing.

export interface Point {
  x: number;
  y: number;
}

/**
 * Ramer–Douglas–Peucker: recursively keeps only the points that deviate
 * from the straight line between the current segment's endpoints by more
 * than `toleranceIn` (same physical units as the points, inches for
 * everything else in this app's data model, but the function itself is
 * unit-agnostic). Always keeps the first and last point.
 */
export function simplifyPoints(points: Point[], toleranceIn: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist <= toleranceIn) return [first, last];

  const left = simplifyPoints(points.slice(0, maxIndex + 1), toleranceIn);
  const right = simplifyPoints(points.slice(maxIndex), toleranceIn);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);

  // Distance from `point` to the infinite line through lineStart/lineEnd,
  // via the standard |cross product| / |line length| formula.
  const cross = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  return cross / Math.sqrt(lengthSq);
}

// --- SVG path `d` parsing --------------------------------------------------

export interface PathCommand {
  raw: string; // exact original text, e.g. "L 10 20" — reused verbatim for pass-through subpaths
  cmd: string; // command letter, case preserved (relative vs absolute)
  args: number[];
}

const POLYLINE_COMMANDS = new Set(["M", "L", "H", "V", "Z"]);

/** Splits a path `d` string into per-command chunks — exported so other modules (AutoDotToDot's node extraction) can walk the same command stream without re-implementing the tokenizer. */
export function tokenizePathData(d: string): PathCommand[] {
  const chunks = d.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];
  return chunks.map((raw) => {
    const cmd = raw[0];
    const args = (raw.slice(1).match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
    return { raw, cmd, args };
  });
}

/** Splits a full path's commands into subpaths — a new "M"/"m" starts a new one, except the very first command. */
export function splitSubpaths(commands: PathCommand[]): PathCommand[][] {
  const subpaths: PathCommand[][] = [];
  let current: PathCommand[] = [];
  for (const c of commands) {
    if ((c.cmd === "M" || c.cmd === "m") && current.length > 0) {
      subpaths.push(current);
      current = [];
    }
    current.push(c);
  }
  if (current.length > 0) subpaths.push(current);
  return subpaths;
}

function isPurePolylineSubpath(subpath: PathCommand[]): boolean {
  return subpath.every((c) => POLYLINE_COMMANDS.has(c.cmd.toUpperCase()));
}

/** Absolute point list for a pure M/L/H/V/Z subpath, resolving relative (lowercase) commands against a running cursor. */
function subpathToPoints(subpath: PathCommand[]): { points: Point[]; closed: boolean } {
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  const points: Point[] = [];
  let closed = false;

  for (const c of subpath) {
    const rel = c.cmd === c.cmd.toLowerCase();
    switch (c.cmd.toUpperCase()) {
      case "M":
        cx = rel ? cx + c.args[0] : c.args[0];
        cy = rel ? cy + c.args[1] : c.args[1];
        startX = cx;
        startY = cy;
        points.push({ x: cx, y: cy });
        break;
      case "L":
        cx = rel ? cx + c.args[0] : c.args[0];
        cy = rel ? cy + c.args[1] : c.args[1];
        points.push({ x: cx, y: cy });
        break;
      case "H":
        cx = rel ? cx + c.args[0] : c.args[0];
        points.push({ x: cx, y: cy });
        break;
      case "V":
        cy = rel ? cy + c.args[0] : c.args[0];
        points.push({ x: cx, y: cy });
        break;
      case "Z":
        cx = startX;
        cy = startY;
        closed = true;
        break;
    }
  }

  return { points, closed };
}

function pointsToSubpathData(points: Point[], closed: boolean): string {
  const [firstPoint, ...rest] = points;
  const body = rest.map((p) => `L ${p.x} ${p.y}`).join(" ");
  return `M ${firstPoint.x} ${firstPoint.y}${body ? ` ${body}` : ""}${closed ? " Z" : ""}`;
}

/**
 * Simplifies just the `d` attribute value of one path. Curve-containing
 * subpaths pass through byte-for-byte; straight-line subpaths are
 * re-serialized from their simplified point list (so formatting
 * normalizes — e.g. consistent spacing — even where point COUNT doesn't
 * change).
 */
export function simplifySvgPathData(d: string, toleranceIn: number): string {
  const subpaths = splitSubpaths(tokenizePathData(d));

  return subpaths
    .map((subpath) => {
      if (!isPurePolylineSubpath(subpath)) {
        return subpath.map((c) => c.raw).join("");
      }
      const { points, closed } = subpathToPoints(subpath);
      if (points.length < 3) return subpath.map((c) => c.raw).join("");
      const simplified = simplifyPoints(points, toleranceIn);
      return pointsToSubpathData(simplified, closed);
    })
    .join(" ");
}

/** Rough weight proxy for a "did this actually get lighter?" readout — counts path commands, not bytes, since that's what drives PDF vector-op count. */
export function countPathCommands(svgMarkup: string): number {
  // Capture just the attribute VALUE (not the `d="` prefix, whose own "d"
  // would otherwise get counted as a spurious command letter).
  const dValues = [...svgMarkup.matchAll(/\sd="([^"]*)"/g)].map((match) => match[1]);
  return dValues.reduce((sum, value) => sum + (value.match(/[a-zA-Z]/g)?.length ?? 0), 0);
}

export interface SvgOptimizationResult {
  svgMarkup: string;
  originalCommandCount: number;
  optimizedCommandCount: number;
  reductionPct: number;
}

/**
 * Finds every `d="..."` attribute in an SVG document and simplifies it in
 * place, via regex rather than a DOM parse — deliberately: the goal is a
 * function that works the same whether it's called from a browser
 * component or from pdfExporter.ts's Node code, without needing a second
 * DOMParser-based implementation the way SvgNormalizer does.
 */
export function optimizeSvgMarkup(svgMarkup: string, toleranceIn = 0.01): SvgOptimizationResult {
  const originalCommandCount = countPathCommands(svgMarkup);

  const optimized = svgMarkup.replace(/(\sd=")([^"]*)(")/g, (_match, prefix, d, suffix) => `${prefix}${simplifySvgPathData(d, toleranceIn)}${suffix}`);

  const optimizedCommandCount = countPathCommands(optimized);
  const reductionPct = originalCommandCount > 0 ? ((originalCommandCount - optimizedCommandCount) / originalCommandCount) * 100 : 0;

  return { svgMarkup: optimized, originalCommandCount, optimizedCommandCount, reductionPct };
}
