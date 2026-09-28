"use client";

import { useEffect, useState } from "react";
import { inchesToPx, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";
import { normalizeSvgToLineArt } from "@/components/kdp-editor/SvgNormalizer";
import type { CountingGroup } from "@/types/kdpBook";

export interface CountingActivityProps {
  width: number; // inches
  height: number; // inches
  groups: CountingGroup[];
  showAnswerBox?: boolean;
  pxPerInch?: number;
}

const ICON_GAP_RATIO = 0.15; // fraction of icon size left as gap between icons

/**
 * A counting/matching worksheet: each group repeats one icon `count` times
 * across a row, with an optional blank box to write the number. Each
 * group's icon is normalized ONCE (not once per repetition) and the same
 * cleaned markup string is reused for every copy in that row.
 */
export default function CountingActivity({ width, height, groups, showAnswerBox = true, pxPerInch = SCREEN_PX_PER_INCH }: CountingActivityProps) {
  const [cleanedIcons, setCleanedIcons] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    // DOMParser is browser-only; see SvgNormalizer's identical note on why
    // this runs in an effect rather than during render.
    const iconSize = Math.min(...groups.map((g) => g.height * (showAnswerBox ? 0.7 : 1)));
    const next = new Map<string, string>();
    for (const group of groups) {
      next.set(group.id, normalizeSvgToLineArt(group.iconSvgMarkup, { targetWidthIn: iconSize, targetHeightIn: iconSize, strokeWeightPt: 2.5 }));
    }
    // Deliberate: same "differs between server and client" pattern as
    // SvgNormalizer — there's no way to compute this during SSR at all.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCleanedIcons(next);
  }, [groups, showAnswerBox]);

  return (
    <div style={{ position: "relative", width: inchesToPx(width, pxPerInch), height: inchesToPx(height, pxPerInch) }}>
      {groups.map((group) => {
        const rowHeight = showAnswerBox ? group.height * 0.7 : group.height;
        const iconSize = Math.min(rowHeight, group.width / (group.count * (1 + ICON_GAP_RATIO)));
        const totalIconsWidth = iconSize * group.count * (1 + ICON_GAP_RATIO);
        const startX = group.x + (group.width - totalIconsWidth) / 2;
        const cleaned = cleanedIcons?.get(group.id);

        return (
          <div key={group.id} style={{ position: "absolute", left: inchesToPx(group.x, pxPerInch), top: inchesToPx(group.y, pxPerInch) }}>
            {Array.from({ length: group.count }, (_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: inchesToPx(startX - group.x + i * iconSize * (1 + ICON_GAP_RATIO), pxPerInch),
                  top: 0,
                  width: inchesToPx(iconSize, pxPerInch),
                  height: inchesToPx(iconSize, pxPerInch),
                }}
                dangerouslySetInnerHTML={cleaned ? { __html: cleaned } : undefined}
              />
            ))}

            {showAnswerBox && (
              <svg
                width={inchesToPx(group.width, pxPerInch)}
                height={inchesToPx(group.height - rowHeight, pxPerInch)}
                viewBox={`0 0 ${group.width} ${group.height - rowHeight}`}
                style={{ position: "absolute", left: 0, top: inchesToPx(rowHeight, pxPerInch) }}
              >
                <rect
                  x={group.width / 2 - 0.3}
                  y={0.05}
                  width={0.6}
                  height={group.height - rowHeight - 0.1}
                  fill="none"
                  stroke="#334155"
                  strokeWidth={0.015}
                  rx={0.05}
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Print-export companion. Unlike TracingGrid/LetterGuide, this doesn't need
 * its own trace-style logic (icons are plain filled/stroked line art, not
 * dashed text) — the caller supplies each group's already-normalized icon
 * markup (e.g. via normalizeSvgToLineArt) so this only handles layout.
 */
export function countingActivityToSvgMarkup(
  width: number,
  height: number,
  groups: CountingGroup[],
  cleanedIconByGroupId: Map<string, string>,
  showAnswerBox: boolean
): string {
  const body = groups
    .map((group) => {
      const rowHeight = showAnswerBox ? group.height * 0.7 : group.height;
      const iconSize = Math.min(rowHeight, group.width / (group.count * (1 + ICON_GAP_RATIO)));
      const totalIconsWidth = iconSize * group.count * (1 + ICON_GAP_RATIO);
      const startX = group.x + (group.width - totalIconsWidth) / 2;
      const cleaned = cleanedIconByGroupId.get(group.id) ?? "";
      // Strip the wrapping <svg ...> tag from the pre-normalized icon markup
      // so it can be embedded as an inner <g> at each repeated position.
      const inner = cleaned.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

      const icons = Array.from({ length: group.count }, (_, i) => {
        const x = startX + i * iconSize * (1 + ICON_GAP_RATIO);
        return `<g transform="translate(${x} ${group.y})"><svg width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}">${inner}</svg></g>`;
      }).join("");

      const answerBox = showAnswerBox
        ? `<rect x="${group.x + group.width / 2 - 0.3}" y="${group.y + rowHeight + 0.05}" width="0.6" height="${group.height - rowHeight - 0.1}" fill="none" stroke="#334155" stroke-width="0.015" rx="0.05" />`
        : "";

      return `${icons}${answerBox}`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`;
}
