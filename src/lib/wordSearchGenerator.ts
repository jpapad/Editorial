import type { WordSearchPlacement } from "@/types/kdpBook";

// 8 directions: horizontal, vertical, and both diagonals, each forward/backward.
const ALL_DIRECTIONS: [number, number][] = [
  [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1],
];

/** Deterministic PRNG (mulberry32) — a numeric seed always produces the same grid, so re-rendering or re-exporting never silently changes the puzzle. */
function createRng(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WordSearchOptions {
  words: string[];
  gridSize: number;
  allowDiagonal?: boolean;
  allowBackward?: boolean;
  seed?: number;
  maxAttemptsPerWord?: number;
}

export interface WordSearchResult {
  grid: string[][];
  placements: WordSearchPlacement[];
  unplacedWords: string[];
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateWordSearch(options: WordSearchOptions): WordSearchResult {
  const { gridSize, allowDiagonal = true, allowBackward = false, seed = 1, maxAttemptsPerWord = 200 } = options;
  const rng = createRng(seed);

  const words = [...options.words]
    .map((w) => w.trim().toUpperCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // longest first — placing big words early leaves more room

  const grid: (string | null)[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
  const placements: WordSearchPlacement[] = [];
  const unplacedWords: string[] = [];

  let directions = allowDiagonal ? ALL_DIRECTIONS : ALL_DIRECTIONS.filter(([r, c]) => r === 0 || c === 0);
  if (!allowBackward) directions = directions.filter(([r, c]) => r >= 0 && !(r === 0 && c < 0));

  function fits(word: string, row: number, col: number, dr: number, dc: number): boolean {
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return false;
      const existing = grid[r][c];
      if (existing !== null && existing !== word[i]) return false;
    }
    return true;
  }

  function place(word: string, row: number, col: number, dr: number, dc: number) {
    for (let i = 0; i < word.length; i++) {
      grid[row + dr * i][col + dc * i] = word[i];
    }
  }

  for (const word of words) {
    if (word.length > gridSize) {
      unplacedWords.push(word);
      continue;
    }

    let placed = false;
    for (let attempt = 0; attempt < maxAttemptsPerWord && !placed; attempt++) {
      const [dr, dc] = directions[Math.floor(rng() * directions.length)];
      const row = Math.floor(rng() * gridSize);
      const col = Math.floor(rng() * gridSize);
      if (fits(word, row, col, dr, dc)) {
        place(word, row, col, dr, dc);
        placements.push({ word, row, col, directionRow: dr, directionCol: dc });
        placed = true;
      }
    }
    if (!placed) unplacedWords.push(word);
  }

  const filledGrid: string[][] = grid.map((row) =>
    row.map((cell) => cell ?? ALPHABET[Math.floor(rng() * ALPHABET.length)])
  );

  return { grid: filledGrid, placements, unplacedWords };
}
