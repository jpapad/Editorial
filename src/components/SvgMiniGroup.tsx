import SvgNormalizer from "@/components/SvgNormalizer";
import type { SvgMiniItem } from "@/types/book";

export interface SvgMiniGroupProps {
  widthIn: number;
  heightIn: number;
  items: SvgMiniItem[];
  strokeWidthPt?: number;
}

/**
 * Lays out a cluster of small secondary line-art icons (e.g. a clownfish, a
 * piece of coral) at pre-resolved positions — typically bottom-of-page
 * filler art for extra coloring. Each item's x/y/width/height are relative
 * to this group's own box, matching SvgMiniGroupElement in the data model,
 * so a book round-trips exactly what was authored.
 */
export default function SvgMiniGroup({ widthIn, heightIn, items, strokeWidthPt = 2.5 }: SvgMiniGroupProps) {
  return (
    <div style={{ position: "relative", width: `${widthIn}in`, height: `${heightIn}in` }}>
      {items.map((item) => (
        <SvgNormalizer
          key={item.id}
          src={item.svgMarkup}
          strokeWidthPt={strokeWidthPt}
          targetWidthIn={item.width}
          targetHeightIn={item.height}
          style={{ position: "absolute", left: `${item.x}in`, top: `${item.y}in` }}
        />
      ))}
    </div>
  );
}

/**
 * Layout helper: given a simple list of icons (just markup, no position),
 * evenly spaces them across a container box and returns fully-resolved
 * SvgMiniItem entries — e.g. for a fresh spread that hasn't been
 * hand-arranged yet. Call once at authoring time and store the result;
 * don't recompute layout on every render.
 */
export function layoutMiniItemsEvenly(
  icons: { id: string; svgMarkup: string }[],
  containerWidthIn: number,
  containerHeightIn: number,
  iconSizeIn: number
): SvgMiniItem[] {
  if (icons.length === 0) return [];

  const gap = (containerWidthIn - icons.length * iconSizeIn) / (icons.length + 1);
  const y = (containerHeightIn - iconSizeIn) / 2;

  return icons.map((icon, i) => ({
    id: icon.id,
    svgMarkup: icon.svgMarkup,
    x: gap + i * (iconSizeIn + gap),
    y,
    width: iconSizeIn,
    height: iconSizeIn,
  }));
}
