import type { DotToDotVertex } from "@/types/book";

/**
 * Authoring-time helper: samples `pointCount` evenly-spaced points along an
 * SVG path using the browser's native path-measurement API, producing the
 * ordered vertex array a DotToDotElement stores. Browser-only — call it
 * when an author converts a piece of line art (SVG path nodes) into a
 * dot-to-dot activity, then persist the resulting vertices, not the path,
 * on the element.
 */
export function samplePathToVertices(pathData: string, pointCount: number): DotToDotVertex[] {
  if (typeof document === "undefined" || pointCount < 2) return [];

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  const totalLength = path.getTotalLength();

  return Array.from({ length: pointCount }, (_, i) => {
    const point = path.getPointAtLength((totalLength * i) / (pointCount - 1));
    return { x: point.x, y: point.y };
  });
}

export interface DotToDotGeneratorProps {
  widthIn: number;
  heightIn: number;
  /** Pre-resolved, ordered points — either authored directly (a coordinate array) or derived via samplePathToVertices(). */
  vertices: DotToDotVertex[];
  dotRadius?: number; // inches
  /** Editor-only faint guide connecting the dots; never shown in print export. */
  showPreviewPath?: boolean;
}

const DOT_COLOR = "#000000";
const PREVIEW_PATH_COLOR = "#c7d2fe";

/** Renders pre-resolved vertices — from an SVG path or a raw coordinate array — as a numbered, printable dot-to-dot activity. */
export default function DotToDotGenerator({
  widthIn,
  heightIn,
  vertices,
  dotRadius = 0.05,
  showPreviewPath = false,
}: DotToDotGeneratorProps) {
  const pathD = vertices.map((v, i) => `${i === 0 ? "M" : "L"} ${v.x} ${v.y}`).join(" ");

  return (
    <svg
      width={`${widthIn}in`}
      height={`${heightIn}in`}
      viewBox={`0 0 ${widthIn} ${heightIn}`}
      className="block"
      role="img"
      aria-label="Dot-to-dot activity"
    >
      {showPreviewPath && vertices.length > 1 && (
        <path d={pathD} fill="none" stroke={PREVIEW_PATH_COLOR} strokeWidth={0.02} strokeDasharray="0.04 0.04" />
      )}
      {vertices.map((v, i) => (
        <g key={i}>
          <circle cx={v.x} cy={v.y} r={dotRadius} fill={DOT_COLOR} />
          <text
            x={v.x + dotRadius * 1.8}
            y={v.y + dotRadius * 0.6}
            fontSize={dotRadius * 3.2}
            fontFamily="Arial, Helvetica, sans-serif"
            fill={DOT_COLOR}
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
