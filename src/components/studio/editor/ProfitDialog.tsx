"use client";

import { useState } from "react";
import { Calculator, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import type { PaperType } from "@/types/editor";
import {
  billedPages,
  formatMoney,
  INK_OPTIONS,
  inkForPaper,
  isLargeTrim,
  MARKETS,
  minimumExpandedPrice,
  minimumListPrice,
  pageRange,
  priceIdeas,
  printingCost,
  royalty,
  type InkType,
  type Marketplace,
} from "@/utils/kdpPricing";

const MARKET_IDS = Object.keys(MARKETS) as Marketplace[];

/**
 * What a KDP paperback earns: printing cost from the page count, trim and
 * ink; royalty at the chosen list price; the lowest price KDP accepts.
 */
export default function ProfitDialog({ pageCount, trimWidthPt, trimHeightPt, paper, onClose }: { pageCount: number; trimWidthPt: number; trimHeightPt: number; paper: PaperType; onClose: () => void }) {
  const t = useT();
  const large = isLargeTrim(trimWidthPt, trimHeightPt);
  const [market, setMarket] = useState<Marketplace>("us");
  const [ink, setInk] = useState<InkType>(inkForPaper(paper));
  const cost = printingCost(market, ink, large, pageCount);
  const [priceText, setPriceText] = useState(() => {
    const c = printingCost("us", inkForPaper(paper), large, pageCount);
    return c === null ? "9.99" : priceIdeas("us", c)[1].toFixed(2);
  });
  const [copiesText, setCopiesText] = useState("30");
  const price = Number(priceText.replace(",", "."));
  const copies = Math.max(0, Math.round(Number(copiesText) || 0));
  const valid = Number.isFinite(price) && price > 0;
  const result = cost !== null && valid ? royalty(market, price, cost) : null;
  const floor = cost !== null ? minimumListPrice(market, cost) : null;
  const range = pageRange(market, ink);
  const money = (n: number) => formatMoney(market, n);

  function changeMarket(next: Marketplace) {
    setMarket(next);
    const c = printingCost(next, ink, large, pageCount);
    if (c !== null) setPriceText(priceIdeas(next, c)[1].toFixed(2));
  }

  const chip = (on: boolean) => cn("rounded-pill border px-3 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", on ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt");
  const field = "h-8 w-full rounded-row-sm border border-hairline bg-panel px-2 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="profit-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()} className="flex max-h-full w-[520px] max-w-full flex-col gap-4 overflow-y-auto rounded-panel bg-panel p-6 shadow-panel">
        <div className="flex items-center justify-between">
          <p id="profit-title" className="flex items-center gap-2 text-modal-title font-semibold tracking-[-0.02em] text-ink">
            <Calculator size={19} aria-hidden />
            {t("Price & royalty")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <MetaLabel>{t("Marketplace")}</MetaLabel>
          <div role="radiogroup" aria-label={t("Marketplace")} className="flex flex-wrap gap-1.5">
            {MARKET_IDS.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={market === id} onClick={() => changeMarket(id)} className={chip(market === id)}>
                {t(MARKETS[id].label)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <MetaLabel>{t("Ink")}</MetaLabel>
          <div role="radiogroup" aria-label={t("Ink")} className="flex flex-wrap gap-1.5">
            {INK_OPTIONS.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={ink === o.value} onClick={() => setInk(o.value)} className={chip(ink === o.value)}>
                {t(o.label)}
              </button>
            ))}
          </div>
          <p className="text-helper text-ink-muted">{t(INK_OPTIONS.find((o) => o.value === ink)!.hint)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <MetaLabel>{t("List price ({currency}, before VAT)", { currency: MARKETS[market].currency })}</MetaLabel>
            <input inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} aria-label={t("List price")} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <MetaLabel>{t("Copies a month")}</MetaLabel>
            <input inputMode="numeric" value={copiesText} onChange={(e) => setCopiesText(e.target.value)} aria-label={t("Copies a month")} className={field} />
          </label>
        </div>
        {cost !== null && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-helper text-ink-muted">{t("Try:")}</span>
            {priceIdeas(market, cost).map((p) => (
              <button key={p} type="button" onClick={() => setPriceText(p.toFixed(2))} className={chip(Math.abs(p - price) < 0.005)}>
                {money(p)}
              </button>
            ))}
          </div>
        )}

        {cost === null ? (
          <p role="alert" className="rounded-row-sm bg-warning/15 px-3 py-2 text-helper text-ink-secondary">
            {t("KDP prints {ink} books from {from} to {to} pages; this one has {n}.", { ink: t(INK_OPTIONS.find((o) => o.value === ink)!.label).toLowerCase(), from: range.from, to: range.to, n: billedPages(pageCount) })}
          </p>
        ) : (
          <dl aria-label={t("Royalty")} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 rounded-row-sm bg-inset-alt px-3 py-3 text-body">
            <dt className="text-ink-secondary">{t("Printed pages")}</dt>
            <dd className="text-right text-ink">
              {billedPages(pageCount)} · {large ? t("large trim") : t("regular trim")}
            </dd>
            <dt className="text-ink-secondary">{t("Printing cost per copy")}</dt>
            <dd className="text-right text-ink">{money(cost)}</dd>
            {result && (
              <>
                <dt className="text-ink-secondary">{t("Royalty rate")}</dt>
                <dd className="text-right text-ink">{Math.round(result.rate * 100)}%</dd>
                <dt className="font-semibold text-ink">{t("You earn per copy on Amazon")}</dt>
                <dd data-testid="royalty-amazon" className={cn("text-right font-semibold", result.amazon < 0 ? "text-error" : "text-ink")}>
                  {money(result.amazon)}
                </dd>
                <dt className="text-ink-secondary">{t("Per copy in bookstores (Expanded Distribution)")}</dt>
                <dd className={cn("text-right", result.expanded < 0 ? "text-error" : "text-ink")}>{result.expanded < 0 ? t("not available") : money(result.expanded)}</dd>
                <dt className="border-t border-hairline pt-1.5 font-semibold text-ink">{t("A month, at {n} copies", { n: copies })}</dt>
                <dd data-testid="royalty-month" className="border-t border-hairline pt-1.5 text-right font-semibold text-ink">
                  {money(Math.max(0, result.amazon) * copies)}
                </dd>
              </>
            )}
          </dl>
        )}

        {result && floor !== null && price < floor && (
          <p role="alert" className="text-helper text-error">
            {t("KDP won't accept a price under {price} for this book: the printing would cost more than you earn.", { price: money(floor) })}
          </p>
        )}
        {result && price + 1e-9 < MARKETS[market].threshold60 && price >= (floor ?? 0) && (
          <p className="text-helper text-ink-muted">{t("At {price} or more KDP pays 60% instead of 50%.", { price: money(MARKETS[market].threshold60) })}</p>
        )}
        {cost !== null && <p className="text-helper text-ink-muted">{t("Expanded Distribution needs at least {price}.", { price: money(minimumExpandedPrice(cost)) })}</p>}
        <p className="text-helper text-ink-muted">{t("Based on KDP's published printing costs and royalty rates (checked October 2026). KDP has the final word: check the price on its pricing page before you publish.")}</p>

        <div className="flex justify-end border-t border-hairline pt-4">
          <Button variant="primary" onClick={onClose}>
            {t("Done")}
          </Button>
        </div>
      </div>
    </div>
  );
}
