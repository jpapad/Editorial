import SvgNormalizer from "@/components/SvgNormalizer";

export interface ShadowMatchingItem {
  id: string;
  /** Same thing SvgNormalizer accepts: a URL/data-URI to fetch, or raw `"<svg>...</svg>"` markup. */
  svgMarkup: string;
  /** Optional caption printed under each icon (e.g. "cat"). */
  label?: string;
}

export interface ShadowMatchingBuilderProps {
  items: ShadowMatchingItem[];
  widthIn: number;
  heightIn: number;
  strokeWidthPt?: number;
  /**
   * Seeds the shuffle of the right-hand silhouette column. The same seed
   * always produces the same order — this MUST be deterministic: if the
   * silhouette order changed between an on-screen preview and the final
   * PDF export, the "answer" a parent checks against wouldn't match what
   * actually printed. Defaults to a fixed value rather than `Date.now()`
   * for exactly this reason.
   */
  shuffleSeed?: number;
}

/**
 * Deterministic PRNG (mulberry32) — `Math.random()` can't be seeded, and a
 * worksheet's shuffle order has to be reproducible across renders/exports
 * (see `shuffleSeed` above).
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(input: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const CONNECTOR_COLOR = "#cbd5e1"; // slate-300 — faint dotted row guide, not part of the puzzle itself
const LABEL_COLOR = "#475569"; // slate-600

function MatchColumn({
  items,
  cellWidthIn,
  cellHeightIn,
  mode,
  strokeWidthPt,
}: {
  items: ShadowMatchingItem[];
  cellWidthIn: number;
  cellHeightIn: number;
  mode: "line" | "silhouette";
  strokeWidthPt: number;
}) {
  return (
    <div className="flex flex-col" style={{ width: `${cellWidthIn}in` }}>
      {items.map((item) => (
        <div key={item.id} className="flex flex-col items-center justify-center" style={{ height: `${cellHeightIn}in` }}>
          <SvgNormalizer
            src={item.svgMarkup}
            mode={mode}
            strokeWidthPt={strokeWidthPt}
            targetWidthIn={cellWidthIn * 0.7}
            targetHeightIn={cellHeightIn * 0.7}
          />
          {mode === "line" && item.label && (
            <span className="mt-1 text-center" style={{ fontSize: "9pt", color: LABEL_COLOR }}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A two-column matching worksheet: line-art icons on the left, the same set
 * of icons re-rendered as solid black silhouettes (shuffled) on the right —
 * the classic "draw a line to match the shape" activity. Both columns reuse
 * SvgNormalizer's existing fetch/parse/normalize pipeline (via its `mode`
 * prop) rather than a second copy of that logic.
 */
export default function ShadowMatchingBuilder({
  items,
  widthIn,
  heightIn,
  strokeWidthPt = 3,
  shuffleSeed = 1,
}: ShadowMatchingBuilderProps) {
  const rightItems = seededShuffle(items, shuffleSeed);
  const columnWidthIn = widthIn * 0.4;
  const gapIn = widthIn * 0.2;
  const cellHeightIn = items.length > 0 ? heightIn / items.length : heightIn;

  return (
    <div
      className="relative flex items-start justify-between"
      style={{ width: `${widthIn}in`, height: `${heightIn}in` }}
      role="img"
      aria-label="Shadow matching worksheet: match each line-art icon to its silhouette"
    >
      <MatchColumn items={items} cellWidthIn={columnWidthIn} cellHeightIn={cellHeightIn} mode="line" strokeWidthPt={strokeWidthPt} />

      {/* Faint dotted row guides across the gap — purely decorative, not the answer key. */}
      <svg
        width={`${gapIn}in`}
        height={`${heightIn}in`}
        viewBox={`0 0 ${gapIn} ${heightIn}`}
        className="shrink-0"
        aria-hidden
      >
        {items.map((_, i) => (
          <line
            key={i}
            x1={0}
            y1={cellHeightIn * i + cellHeightIn / 2}
            x2={gapIn}
            y2={cellHeightIn * i + cellHeightIn / 2}
            stroke={CONNECTOR_COLOR}
            strokeWidth={0.01}
            strokeDasharray="0.04 0.06"
          />
        ))}
      </svg>

      <MatchColumn items={rightItems} cellWidthIn={columnWidthIn} cellHeightIn={cellHeightIn} mode="silhouette" strokeWidthPt={strokeWidthPt} />
    </div>
  );
}
