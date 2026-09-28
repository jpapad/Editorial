"use client";

import { useState } from "react";

export interface DailyPoint {
  day: string; // YYYY-MM-DD
  value: number;
}

const HEIGHT = 96;
const BAR_GAP = 2;
const dayFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

/**
 * One measure per day as thin bars (single series, so no legend — the
 * title names it). Hover or focus a day for its exact value; a visually
 * hidden table carries the same numbers for screen readers.
 */
export default function ActivityChart({ title, points, unit }: { title: string; points: DailyPoint[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  const n = Math.max(1, points.length);
  const label = (p: DailyPoint) => dayFmt.format(new Date(`${p.day}T00:00:00`));

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-card-title font-semibold text-ink">{title}</span>
        <span className="text-helper text-ink-muted">
          {total} {unit}
        </span>
      </figcaption>

      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${n * 10} ${HEIGHT}`} preserveAspectRatio="none" className="block h-24 w-full" aria-hidden="true">
          {/* recessive baseline + max gridline */}
          <line x1={0} x2={n * 10} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke="var(--color-hairline)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={n * 10} y1={0.5} y2={0.5} stroke="var(--color-hairline)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => {
            const h = p.value === 0 ? 0 : Math.max(2, (p.value / max) * (HEIGHT - 4));
            return (
              <g key={p.day}>
                <rect
                  x={i * 10 + BAR_GAP / 2}
                  y={HEIGHT - h}
                  width={10 - BAR_GAP}
                  height={h}
                  rx={Math.min(2, h / 2)}
                  fill="var(--color-accent)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
                {/* hit target: the full column, much larger than the bar */}
                <rect x={i * 10} y={0} width={10} height={HEIGHT} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        <span className="pointer-events-none absolute right-0 top-0 -translate-y-1/2 bg-panel pl-1 font-pw-mono text-mono text-ink-muted">{max}</span>

        {hover !== null && points[hover] && (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-row-sm bg-ink px-2 py-1 text-helper text-white shadow-toolbar"
            style={{ left: `${((hover + 0.5) / n) * 100}%` }}
          >
            {label(points[hover])}: <b>{points[hover].value}</b> {unit}
          </div>
        )}
      </div>

      <div className="flex justify-between font-pw-mono text-mono text-ink-muted">
        <span>{points[0] && label(points[0])}</span>
        <span>{points.at(-1) && label(points.at(-1)!)}</span>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <th scope="row">{label(p)}</th>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
