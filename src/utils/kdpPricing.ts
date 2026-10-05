// KDP paperback money math: printing cost, royalty and the lowest list
// price KDP accepts, for the marketplaces most of our users sell in.
//
// Numbers from KDP's own help pages, checked 2026-10-05:
//   printing costs — https://kdp.amazon.com/en_US/help/topic/G201834340
//   royalty rates  — https://kdp.amazon.com/en_US/help/topic/G201834330
// KDP changes these now and then; when it does, this table is the one
// place to update. List prices here are before VAT (KDP adds VAT on top
// in the UK and EU, and pays royalty on the price without it).

import type { PaperType } from "@/types/editor";

export type Marketplace = "us" | "uk" | "eu";
export type InkType = "black" | "standard-color" | "premium-color";

interface Tier {
  /** Inclusive page range. */
  from: number;
  to: number;
  fixed: number;
  perPage: number;
}

interface MarketData {
  label: string;
  currency: "USD" | "GBP" | "EUR";
  symbol: string;
  /** From this list price up the royalty is 60%, below it 50%. */
  threshold60: number;
  /** [regular trim, large trim] tiers per ink. */
  costs: Record<InkType, [Tier[], Tier[]]>;
}

export const MARKETS: Record<Marketplace, MarketData> = {
  us: {
    label: "Amazon.com (USD)",
    currency: "USD",
    symbol: "$",
    threshold60: 9.99,
    costs: {
      black: [
        [{ from: 24, to: 108, fixed: 2.3, perPage: 0 }, { from: 110, to: 828, fixed: 1.0, perPage: 0.012 }],
        [{ from: 24, to: 108, fixed: 2.84, perPage: 0 }, { from: 110, to: 828, fixed: 1.0, perPage: 0.017 }],
      ],
      "standard-color": [[{ from: 72, to: 600, fixed: 1.0, perPage: 0.0255 }], [{ from: 72, to: 600, fixed: 1.0, perPage: 0.0402 }]],
      "premium-color": [
        [{ from: 24, to: 40, fixed: 3.6, perPage: 0 }, { from: 42, to: 828, fixed: 1.0, perPage: 0.065 }],
        [{ from: 24, to: 40, fixed: 4.2, perPage: 0 }, { from: 42, to: 828, fixed: 1.0, perPage: 0.08 }],
      ],
    },
  },
  uk: {
    label: "Amazon.co.uk (GBP)",
    currency: "GBP",
    symbol: "£",
    threshold60: 7.99,
    costs: {
      black: [
        [{ from: 24, to: 108, fixed: 1.93, perPage: 0 }, { from: 110, to: 828, fixed: 0.85, perPage: 0.01 }],
        [{ from: 24, to: 108, fixed: 2.15, perPage: 0 }, { from: 110, to: 828, fixed: 0.85, perPage: 0.012 }],
      ],
      "standard-color": [[{ from: 72, to: 600, fixed: 0.85, perPage: 0.02 }], [{ from: 72, to: 600, fixed: 0.85, perPage: 0.027 }]],
      "premium-color": [
        [{ from: 24, to: 40, fixed: 2.59, perPage: 0 }, { from: 42, to: 828, fixed: 0.85, perPage: 0.0435 }],
        [{ from: 24, to: 40, fixed: 3.24, perPage: 0 }, { from: 42, to: 828, fixed: 0.85, perPage: 0.0598 }],
      ],
    },
  },
  eu: {
    label: "Amazon.de / .fr / .it / .es (EUR)",
    currency: "EUR",
    symbol: "€",
    threshold60: 9.99,
    costs: {
      black: [
        [{ from: 24, to: 108, fixed: 2.05, perPage: 0 }, { from: 110, to: 828, fixed: 0.75, perPage: 0.012 }],
        [{ from: 24, to: 108, fixed: 2.48, perPage: 0 }, { from: 110, to: 828, fixed: 0.75, perPage: 0.016 }],
      ],
      "standard-color": [[{ from: 72, to: 600, fixed: 0.75, perPage: 0.024 }], [{ from: 72, to: 600, fixed: 0.75, perPage: 0.035 }]],
      "premium-color": [
        [{ from: 24, to: 40, fixed: 2.85, perPage: 0 }, { from: 42, to: 828, fixed: 0.75, perPage: 0.0525 }],
        [{ from: 24, to: 40, fixed: 3.61, perPage: 0 }, { from: 42, to: 828, fixed: 0.75, perPage: 0.0715 }],
      ],
    },
  },
};

export const INK_OPTIONS: { value: InkType; label: string; hint: string }[] = [
  { value: "black", label: "Black ink", hint: "The usual choice for coloring books: the pages are black lines anyway." },
  { value: "standard-color", label: "Standard color", hint: "Color pages, 72 pages or more." },
  { value: "premium-color", label: "Premium color", hint: "Brightest color — the most expensive to print." },
];

export const EXPANDED_DISTRIBUTION_RATE = 0.4;

/** "More than 6.12 in wide or more than 9 in tall" (KDP). 8.5 × 11 and 8 × 10 are large; 6 × 9 is regular. */
export function isLargeTrim(widthPt: number, heightPt: number): boolean {
  return widthPt / 72 > 6.12 + 1e-9 || heightPt / 72 > 9 + 1e-9;
}

/** KDP prints an even number of pages; an odd count gets a blank at the end. */
export function billedPages(pageCount: number): number {
  return pageCount % 2 === 0 ? pageCount : pageCount + 1;
}

/** Printing cost per copy, or null when this ink can't be printed at this page count. */
export function printingCost(market: Marketplace, ink: InkType, largeTrim: boolean, pageCount: number): number | null {
  const pages = billedPages(pageCount);
  const tier = MARKETS[market].costs[ink][largeTrim ? 1 : 0].find((t) => pages >= t.from && pages <= t.to);
  return tier ? round2(tier.fixed + tier.perPage * pages) : null;
}

/** The page range KDP prints this ink in. */
export function pageRange(market: Marketplace, ink: InkType): { from: number; to: number } {
  const tiers = MARKETS[market].costs[ink][0];
  return { from: tiers[0].from, to: tiers[tiers.length - 1].to };
}

export function royaltyRate(market: Marketplace, listPrice: number): number {
  return listPrice + 1e-9 >= MARKETS[market].threshold60 ? 0.6 : 0.5;
}

export interface RoyaltyResult {
  rate: number;
  /** Per copy sold on Amazon. Can be negative: KDP won't accept that price. */
  amazon: number;
  /** Per copy sold through Expanded Distribution (bookstores, libraries). */
  expanded: number;
}

export function royalty(market: Marketplace, listPrice: number, cost: number): RoyaltyResult {
  const rate = royaltyRate(market, listPrice);
  return { rate, amazon: round2(rate * listPrice - cost), expanded: round2(EXPANDED_DISTRIBUTION_RATE * listPrice - cost) };
}

/** The lowest list price KDP allows: the one where the royalty is no longer negative. */
export function minimumListPrice(market: Marketplace, cost: number): number {
  const at50 = ceil2(cost / 0.5);
  const threshold = MARKETS[market].threshold60;
  if (at50 < threshold) return at50;
  return Math.max(threshold, ceil2(cost / 0.6));
}

/** Lowest list price for Expanded Distribution (40% minus printing). */
export function minimumExpandedPrice(cost: number): number {
  return ceil2(cost / EXPANDED_DISTRIBUTION_RATE);
}

/**
 * Price ideas: the floor, the first price that earns 60%, and a "charm"
 * price a little above it — the usual sweet spots for coloring books.
 */
export function priceIdeas(market: Marketplace, cost: number): number[] {
  const floor = minimumListPrice(market, cost);
  const sixty = Math.max(floor, MARKETS[market].threshold60);
  const charm = Math.ceil(sixty + 1) - 0.01;
  return [...new Set([floor, sixty, charm])].sort((a, b) => a - b);
}

/** The ink a book's paper choice implies (premium color paper is premium color ink). */
export function inkForPaper(paper: PaperType): InkType {
  return paper === "color" ? "premium-color" : "black";
}

export function formatMoney(market: Marketplace, amount: number): string {
  const { symbol } = MARKETS[market];
  const sign = amount < 0 ? "−" : "";
  return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ceil2(n: number): number {
  return Math.ceil(n * 100 - 1e-6) / 100;
}
