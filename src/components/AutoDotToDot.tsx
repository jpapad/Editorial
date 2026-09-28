import DotToDotGenerator, { type DotToDotGeneratorProps } from "@/components/DotToDotGenerator";
import { simplifyPoints, tokenizePathData, splitSubpaths, type Point, type PathCommand } from "@/utils/svgOptimizer";
import type { DotToDotVertex } from "@/types/book";

/**
 * Sprint 2's samplePathToVertices() (DotToDotGenerator.tsx) samples a path
 * at evenly-spaced ARC-LENGTH intervals — good for smooth curves, but it
 * ignores the path's actual authored geometry, so a sharp corner can land
 * between two sample points and get rounded off. This does the opposite:
 * it walks the path's own command list and extracts each command's
 * anchor/endpoint node, in order, then thins that list down to the
 * "outer"/significant nodes via the same Douglas-Peucker simplifier
 * svgOptimizer.ts uses for path weight reduction — so corners are
 * guaranteed to survive (that's exactly what Douglas-Peucker preserves),
 * at the cost of NOT flattening curves into intermediate points: a
 * cubic/quadratic curve command contributes only its own endpoint, not
 * points along its interior arc. For geometric/angular shapes (stars,
 * polygons, blocky mascots) that's the more useful node set for a
 * dot-to-dot; for a smooth round shape (a circle, a wave), samplePathToVertices
 * is still the better tool.
 */
export interface AutoDotToDotOptions {
  /** Perpendicular-distance threshold (inches) below which a node is considered redundant and dropped. Larger = fewer dots. */
  simplifyToleranceIn?: number;
  /** Hard cap — if simplification still leaves more nodes than this, evenly thins the remainder. */
  maxPoints?: number;
}

interface Cursor {
  x: number;
  y: number;
  startX: number;
  startY: number;
}

/**
 * Every command's terminal anchor point within ONE subpath, in authored
 * order — curve control points are NOT included, only where the pen ends
 * up. Takes/returns the running cursor so relative (lowercase) commands
 * resolve correctly even though subpaths are processed one at a time (a
 * later subpath's relative coordinates are relative to wherever the pen
 * was left by the previous subpath, not to (0,0)).
 */
function nodesForSubpath(commands: PathCommand[], cursor: Cursor): Point[] {
  let cx = cursor.x;
  let cy = cursor.y;
  let startX = cursor.startX;
  let startY = cursor.startY;
  const nodes: Point[] = [];

  for (const c of commands) {
    const rel = c.cmd === c.cmd.toLowerCase();
    const upper = c.cmd.toUpperCase();
    const last2 = (fallbackX: number, fallbackY: number) => {
      const x = rel ? cx + fallbackX : fallbackX;
      const y = rel ? cy + fallbackY : fallbackY;
      return { x, y };
    };

    switch (upper) {
      case "M": {
        const { x, y } = last2(c.args[0], c.args[1]);
        cx = x;
        cy = y;
        startX = x;
        startY = y;
        nodes.push({ x, y });
        break;
      }
      case "L": {
        const { x, y } = last2(c.args[0], c.args[1]);
        cx = x;
        cy = y;
        nodes.push({ x, y });
        break;
      }
      case "H": {
        const x = rel ? cx + c.args[0] : c.args[0];
        cx = x;
        nodes.push({ x, y: cy });
        break;
      }
      case "V": {
        const y = rel ? cy + c.args[0] : c.args[0];
        cy = y;
        nodes.push({ x: cx, y });
        break;
      }
      case "C": {
        const { x, y } = last2(c.args[4], c.args[5]);
        cx = x;
        cy = y;
        nodes.push({ x, y });
        break;
      }
      case "S":
      case "Q": {
        const { x, y } = last2(c.args[2], c.args[3]);
        cx = x;
        cy = y;
        nodes.push({ x, y });
        break;
      }
      case "T": {
        const { x, y } = last2(c.args[0], c.args[1]);
        cx = x;
        cy = y;
        nodes.push({ x, y });
        break;
      }
      case "A": {
        const { x, y } = last2(c.args[5], c.args[6]);
        cx = x;
        cy = y;
        nodes.push({ x, y });
        break;
      }
      case "Z": {
        cx = startX;
        cy = startY;
        // Deliberately not pushed as its own node — Z returns to the
        // subpath's starting M, which is already the first node; adding
        // it again would duplicate the start point at the end of the loop.
        break;
      }
    }
  }

  cursor.x = cx;
  cursor.y = cy;
  cursor.startX = startX;
  cursor.startY = startY;
  return nodes;
}

/**
 * Groups a full path's nodes by subpath, carrying the pen position across
 * subpath boundaries so relative commands in a later subpath still
 * resolve correctly.
 */
function extractNodesBySubpath(pathData: string): Point[][] {
  const subpaths = splitSubpaths(tokenizePathData(pathData));
  const cursor: Cursor = { x: 0, y: 0, startX: 0, startY: 0 };
  return subpaths.map((subpath) => nodesForSubpath(subpath, cursor));
}

/**
 * Every path command's terminal anchor point, in authored order, across
 * ALL subpaths concatenated. Exposed for callers who know their source is
 * genuinely single-subpath already; autoDotToDot() below does NOT use
 * this directly (see its own note on why — branching/multi-subpath art
 * would otherwise get phantom connecting lines between unrelated
 * branches).
 */
export function extractPathNodes(pathData: string): Point[] {
  return extractNodesBySubpath(pathData).flat();
}

/** Evenly thins a point list down to `maxPoints`, always keeping the first and last. */
function thinToMax(points: Point[], maxPoints: number): Point[] {
  if (points.length <= maxPoints || maxPoints < 2) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => points[Math.round(i * step)]);
}

/**
 * The full pipeline: authored path nodes -> largest single subpath ->
 * Douglas-Peucker thinning -> (optional) hard cap -> numbered
 * DotToDotVertex array, ready for DotToDotGenerator or persisting onto a
 * DotToDotElement.
 *
 * A dot-to-dot is inherently ONE continuous traceable outline (see
 * DotToDotGenerator: it joins consecutive vertices with straight lines).
 * Branching/multi-part art (e.g. this project's own coral sample SVG,
 * whose several disconnected branches are drawn as separate subpaths) has
 * no single continuous outline to trace — concatenating every subpath's
 * nodes would draw a spurious straight line jumping between unrelated
 * branches. Picking just the largest subpath (by node count, before
 * simplification) is the honest fix: it produces one real, traceable
 * outline instead of a numerically-numbered but visually-wrong path. If a
 * source SVG genuinely is one continuous subpath (the common case for a
 * silhouette/outline), this has no effect at all.
 */
export function autoDotToDot(pathData: string, options: AutoDotToDotOptions = {}): DotToDotVertex[] {
  const { simplifyToleranceIn = 0.05, maxPoints } = options;
  const subpaths = extractNodesBySubpath(pathData);
  const largest = subpaths.reduce((best, s) => (s.length > best.length ? s : best), subpaths[0] ?? []);
  const simplified = simplifyPoints(largest, simplifyToleranceIn);
  return maxPoints ? thinToMax(simplified, maxPoints) : simplified;
}

export interface AutoDotToDotProps extends Omit<DotToDotGeneratorProps, "vertices">, AutoDotToDotOptions {
  pathData: string;
}

/** Thin composition wrapper: derives vertices from `pathData` via autoDotToDot(), then renders them with the existing DotToDotGenerator — no separate rendering logic to keep in sync. */
export default function AutoDotToDot({ pathData, simplifyToleranceIn, maxPoints, ...rest }: AutoDotToDotProps) {
  const vertices = autoDotToDot(pathData, { simplifyToleranceIn, maxPoints });
  return <DotToDotGenerator {...rest} vertices={vertices} />;
}
