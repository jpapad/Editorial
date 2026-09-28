import { inchesToPx, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";
import type { WordSearchPlacement } from "@/types/kdpBook";

export interface WordSearchGridProps {
  width: number; // inches
  height: number; // inches
  grid: string[][];
  words: string[];
  placements: WordSearchPlacement[];
  pxPerInch?: number;
  /** Editor aid only — highlights the solution; the printed page never shows it. */
  showSolution?: boolean;
}

const LETTER_COLOR = "#000000";
const GRID_LINE_COLOR = "#cbd5e1";
const SOLUTION_COLOR = "#fca5a5";

/** Renders a pre-generated word-search grid (see generateWordSearch()) plus the word list to find beneath it. */
export default function WordSearchGrid({
  width,
  height,
  grid,
  words,
  placements,
  pxPerInch = SCREEN_PX_PER_INCH,
  showSolution = false,
}: WordSearchGridProps) {
  const gridSize = grid.length;
  const wordListHeight = height * 0.18;
  const gridHeight = height - wordListHeight;
  const cell = Math.min(width / gridSize, gridHeight / gridSize);
  const gridPxWidth = cell * gridSize;
  const gridOffsetX = (width - gridPxWidth) / 2;
  const fontSize = cell * 0.55;

  return (
    <svg
      width={inchesToPx(width, pxPerInch)}
      height={inchesToPx(height, pxPerInch)}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      role="img"
      aria-label="Word search puzzle"
    >
      {showSolution &&
        placements.map((p) => {
          const x1 = gridOffsetX + p.col * cell + cell / 2;
          const y1 = p.row * cell + cell / 2;
          const x2 = gridOffsetX + (p.col + p.directionCol * (p.word.length - 1)) * cell + cell / 2;
          const y2 = (p.row + p.directionRow * (p.word.length - 1)) * cell + cell / 2;
          return (
            <line key={p.word} x1={x1} y1={y1} x2={x2} y2={y2} stroke={SOLUTION_COLOR} strokeWidth={cell * 0.7} strokeLinecap="round" />
          );
        })}

      {Array.from({ length: gridSize + 1 }, (_, i) => (
        <g key={`grid-${i}`}>
          <line x1={gridOffsetX + i * cell} y1={0} x2={gridOffsetX + i * cell} y2={gridPxWidth} stroke={GRID_LINE_COLOR} strokeWidth={0.008} />
          <line x1={gridOffsetX} y1={i * cell} x2={gridOffsetX + gridPxWidth} y2={i * cell} stroke={GRID_LINE_COLOR} strokeWidth={0.008} />
        </g>
      ))}

      {grid.map((row, r) =>
        row.map((letter, c) => (
          <text
            key={`${r}-${c}`}
            x={gridOffsetX + c * cell + cell / 2}
            y={r * cell + cell / 2 + fontSize * 0.35}
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize={fontSize}
            textAnchor="middle"
            fill={LETTER_COLOR}
          >
            {letter}
          </text>
        ))
      )}

      <text x={0} y={gridPxWidth + wordListHeight * 0.35} fontFamily="Arial, Helvetica, sans-serif" fontSize={wordListHeight * 0.22} fontWeight="bold" fill={LETTER_COLOR}>
        Find these words:
      </text>
      <text
        x={0}
        y={gridPxWidth + wordListHeight * 0.7}
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize={wordListHeight * 0.2}
        fill={LETTER_COLOR}
        style={{ letterSpacing: "0.02em" }}
      >
        {words.map((w) => w.toUpperCase()).join("   •   ")}
      </text>
    </svg>
  );
}

/** Print-export companion — see the equivalent note in TracingGrid.tsx. */
export function wordSearchToSvgMarkup(props: Omit<WordSearchGridProps, "pxPerInch">): string {
  const { width, height, grid, words, placements, showSolution = false } = props;
  const gridSize = grid.length;
  const wordListHeight = height * 0.18;
  const gridHeight = height - wordListHeight;
  const cell = Math.min(width / gridSize, gridHeight / gridSize);
  const gridPxWidth = cell * gridSize;
  const gridOffsetX = (width - gridPxWidth) / 2;
  const fontSize = cell * 0.55;

  const solutionLines = showSolution
    ? placements
        .map((p) => {
          const x1 = gridOffsetX + p.col * cell + cell / 2;
          const y1 = p.row * cell + cell / 2;
          const x2 = gridOffsetX + (p.col + p.directionCol * (p.word.length - 1)) * cell + cell / 2;
          const y2 = (p.row + p.directionRow * (p.word.length - 1)) * cell + cell / 2;
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${SOLUTION_COLOR}" stroke-width="${cell * 0.7}" stroke-linecap="round" />`;
        })
        .join("")
    : "";

  const gridLines = Array.from({ length: gridSize + 1 }, (_, i) => `
    <line x1="${gridOffsetX + i * cell}" y1="0" x2="${gridOffsetX + i * cell}" y2="${gridPxWidth}" stroke="${GRID_LINE_COLOR}" stroke-width="0.008" />
    <line x1="${gridOffsetX}" y1="${i * cell}" x2="${gridOffsetX + gridPxWidth}" y2="${i * cell}" stroke="${GRID_LINE_COLOR}" stroke-width="0.008" />
  `).join("");

  const letters = grid
    .map((row, r) =>
      row
        .map(
          (letter, c) =>
            `<text x="${gridOffsetX + c * cell + cell / 2}" y="${r * cell + cell / 2 + fontSize * 0.35}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${LETTER_COLOR}">${letter}</text>`
        )
        .join("")
    )
    .join("");

  const wordList = `<text x="0" y="${gridPxWidth + wordListHeight * 0.35}" font-family="Arial, Helvetica, sans-serif" font-size="${wordListHeight * 0.22}" font-weight="bold" fill="${LETTER_COLOR}">Find these words:</text>
    <text x="0" y="${gridPxWidth + wordListHeight * 0.7}" font-family="Arial, Helvetica, sans-serif" font-size="${wordListHeight * 0.2}" fill="${LETTER_COLOR}">${words.map((w) => w.toUpperCase()).join("   •   ")}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${solutionLines}${gridLines}${letters}${wordList}</svg>`;
}
