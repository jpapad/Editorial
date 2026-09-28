import { inchesToPx, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";
import type { ColorByNumberZone } from "@/types/kdpBook";
import SvgNormalizer from "@/components/kdp-editor/SvgNormalizer";

export interface ColorByNumberRendererProps {
  width: number; // inches
  height: number; // inches
  outlineSvgMarkup: string; // already cleaned by extractColorByNumberZones()
  zones: ColorByNumberZone[];
  showColorKey?: boolean;
  pxPerInch?: number;
}

const LABEL_RADIUS = 0.09; // inches
const KEY_HEIGHT_IN = 0.6;

/** Renders a Color-by-Number page: the blank numbered outline, plus an optional color-key legend. */
export default function ColorByNumberRenderer({
  width,
  height,
  outlineSvgMarkup,
  zones,
  showColorKey = true,
  pxPerInch = SCREEN_PX_PER_INCH,
}: ColorByNumberRendererProps) {
  const artHeight = showColorKey ? height - KEY_HEIGHT_IN : height;

  return (
    <div style={{ position: "relative", width: inchesToPx(width, pxPerInch), height: inchesToPx(height, pxPerInch) }}>
      <div style={{ position: "relative", width: inchesToPx(width, pxPerInch), height: inchesToPx(artHeight, pxPerInch) }}>
        <SvgNormalizer
          svgMarkup={outlineSvgMarkup}
          strokeWeightPt={1.5}
          targetWidthIn={width}
          targetHeightIn={artHeight}
          style={{ position: "absolute", left: 0, top: 0 }}
        />
        <svg
          width={inchesToPx(width, pxPerInch)}
          height={inchesToPx(artHeight, pxPerInch)}
          viewBox={`0 0 ${width} ${artHeight}`}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          {zones.map((zone) => (
            <g key={zone.id}>
              <circle cx={zone.labelX} cy={zone.labelY} r={LABEL_RADIUS} fill="#ffffff" stroke="#000000" strokeWidth={0.012} />
              <text
                x={zone.labelX}
                y={zone.labelY + LABEL_RADIUS * 0.35}
                textAnchor="middle"
                fontSize={LABEL_RADIUS * 1.3}
                fontFamily="Arial, Helvetica, sans-serif"
                fontWeight="bold"
                fill="#000000"
              >
                {zone.number}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {showColorKey && (
        <svg
          width={inchesToPx(width, pxPerInch)}
          height={inchesToPx(KEY_HEIGHT_IN, pxPerInch)}
          viewBox={`0 0 ${width} ${KEY_HEIGHT_IN}`}
          style={{ position: "absolute", left: 0, top: inchesToPx(artHeight, pxPerInch) }}
        >
          {zones.map((zone, i) => {
            const cx = 0.3 + i * 0.9;
            return (
              <g key={zone.id}>
                <rect x={cx} y={0.12} width={0.3} height={0.3} fill={zone.colorHex} stroke="#000000" strokeWidth={0.01} />
                <text x={cx + 0.4} y={0.34} fontSize={0.2} fontFamily="Arial, Helvetica, sans-serif" fill="#000000">
                  {zone.number}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
