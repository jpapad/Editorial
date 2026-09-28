import { inchesToPx, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";
import type { DotToDotVertex } from "@/types/kdpBook";

/**
 * Authoring-time helper: samples `pointCount` evenly-spaced points along an
 * SVG path using the browser's native path-measurement API, producing the
 * ordered vertex list a DotToDotElement stores. Browser-only — call it when
 * an author converts a piece of line art into a dot-to-dot activity, then
 * persist the resulting vertices (not the path) in the element.
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
  width: number; // inches
  height: number; // inches
  vertices: DotToDotVertex[];
  /** Faint connecting line for editor preview only — never rendered in print export. */
  showPreviewPath?: boolean;
  dotRadius?: number; // inches
  pxPerInch?: number;
}

/** Renders pre-resolved vertices as a numbered dot-to-dot activity page. */
export default function DotToDotGenerator({
  width,
  height,
  vertices,
  showPreviewPath = false,
  dotRadius = 0.04,
  pxPerInch = SCREEN_PX_PER_INCH,
}: DotToDotGeneratorProps) {
  const pathD = vertices.map((v, i) => `${i === 0 ? "M" : "L"} ${v.x} ${v.y}`).join(" ");

  return (
    <svg
      width={inchesToPx(width, pxPerInch)}
      height={inchesToPx(height, pxPerInch)}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      role="img"
      aria-label="Dot-to-dot activity"
    >
      {showPreviewPath && vertices.length > 1 && (
        <path d={pathD} fill="none" stroke="#c7d2fe" strokeWidth={0.02} strokeDasharray="0.04 0.04" />
      )}
      {vertices.map((v, i) => (
        <g key={i}>
          <circle cx={v.x} cy={v.y} r={dotRadius} fill="#000000" />
          <text
            x={v.x + dotRadius * 1.8}
            y={v.y + dotRadius * 0.6}
            fontSize={dotRadius * 3.2}
            fontFamily="Arial, Helvetica, sans-serif"
            fill="#000000"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
