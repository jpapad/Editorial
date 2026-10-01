"use client";

import { BookOpen, Download, History, Images, LayoutTemplate, Loader2, ShoppingBag, Type } from "lucide-react";
import Card from "@/components/studio/ui/Card";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Toggle from "@/components/studio/ui/Toggle";
import { MIN_PAGES, PAPER_OPTIONS, SPINE_TEXT_MIN_PAGES, type CoverLayout } from "@/utils/coverGeometry";
import type { PaperType } from "@/types/editor";
import { useT } from "@/lib/i18n";

const fmtIn = (pt: number) => `${(pt / 72).toFixed(3)} in`;

/** Book-wide print settings, shown under the Page card in Draw mode. */
export function BookPrintCard({
  trimLabel,
  bleed,
  onToggleBleed,
  converting,
  onOpenListing,
  onShareTemplate,
  onOpenMockups,
  onOpenVersions,
}: {
  trimLabel: string;
  bleed: boolean;
  onToggleBleed: (on: boolean) => void;
  converting: boolean;
  onOpenListing: () => void;
  onShareTemplate: () => void;
  onOpenMockups: () => void;
  onOpenVersions: () => void;
}) {
  const t = useT();
  return (
    <Card className="flex shrink-0 flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-card-title font-semibold text-ink">{t("Book print")}</p>
        <MetaLabel>{trimLabel}</MetaLabel>
      </div>
      <Toggle checked={bleed} onChange={onToggleBleed} label={t("Print to the edge (bleed)")} />
      <p className="text-helper text-ink-muted">
        {bleed
          ? t("Pages extend 0.125 in past the trim (the tinted band). Art that should reach the paper's edge must fill it; it gets cut off.")
          : t("White margin around every page. Turn on bleed for art that runs off the edge.")}
      </p>
      {converting && (
        <p className="flex items-center gap-1.5 text-helper text-ink-secondary">
          <Loader2 size={12} className="animate-spin" /> {t("Resizing pages…")}
        </p>
      )}
      <Button variant="secondary" size="sm" icon={<ShoppingBag size={13} />} onClick={onOpenListing}>
        {t("Amazon listing kit")}
      </Button>
      <Button variant="secondary" size="sm" icon={<Images size={13} />} onClick={onOpenMockups}>
        {t("Listing mockups")}
      </Button>
      <Button variant="ghost" size="sm" icon={<History size={13} />} onClick={onOpenVersions}>
        {t("Version history")}
      </Button>
      <Button variant="ghost" size="sm" icon={<LayoutTemplate size={13} />} onClick={onShareTemplate}>
        {t("Share as a template")}
      </Button>
    </Card>
  );
}

export interface CoverCardProps {
  layout: CoverLayout;
  pageCount: number;
  paper: PaperType;
  onPaperChange: (paper: PaperType) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  onAddSpineText: () => void;
  onExportCover: () => void;
  exporting: boolean;
}

/** Cover mode's settings: the spine math (page count × paper), background, spine title, cover PDF. */
export function CoverCard(props: CoverCardProps) {
  const { layout, pageCount } = props;
  const tooFew = pageCount < MIN_PAGES;
  const t = useT();
  return (
    <Card className="flex shrink-0 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <BookOpen size={15} className="text-accent" />
        <p className="text-card-title font-semibold text-ink">{t("Paperback cover")}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-helper">
        <dt className="text-ink-muted">{t("Interior pages")}</dt>
        <dd className="text-right font-medium text-ink">{pageCount}</dd>
        <dt className="text-ink-muted">{t("Spine width")}</dt>
        <dd className="text-right font-medium text-ink">{fmtIn(layout.spine)}</dd>
        <dt className="text-ink-muted">{t("Full cover")}</dt>
        <dd className="text-right font-medium text-ink">
          {(layout.space.width / 72).toFixed(3)} × {(layout.space.height / 72).toFixed(3)} in
        </dd>
      </dl>
      {tooFew && <p className="rounded-row-sm bg-warning/15 px-2.5 py-2 text-helper text-ink-secondary">{t("KDP paperbacks need at least {n} pages — the spine is sized for {n} until you add more.", { n: MIN_PAGES })}</p>}

      <label className="flex flex-col gap-1">
        <MetaLabel>{t("Paper")}</MetaLabel>
        <select
          value={props.paper}
          onChange={(e) => props.onPaperChange(e.target.value as PaperType)}
          className="h-8 rounded-row-sm border border-hairline bg-panel px-2 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {PAPER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between text-helper text-ink-secondary">
        {t("Background color")}
        <input type="color" value={props.backgroundColor} onChange={(e) => props.onBackgroundColorChange(e.target.value)} className="h-8 w-12 cursor-pointer rounded-row-sm border border-hairline" />
      </label>

      <div className="flex flex-col gap-1">
        <Button variant="secondary" size="sm" icon={<Type size={13} />} onClick={props.onAddSpineText} disabled={!layout.spineTextAllowed}>
          {t("Add spine title")}
        </Button>
        {!layout.spineTextAllowed && <p className="text-helper text-ink-muted">{t("KDP allows spine text from {n} pages up.", { n: SPINE_TEXT_MIN_PAGES })}</p>}
      </div>

      <Button variant="primary" size="sm" icon={props.exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} onClick={props.onExportCover} disabled={props.exporting}>
        {t("Export cover PDF")}
      </Button>
      <p className="text-helper text-ink-muted">{t("Upload this PDF as the paperback cover in KDP. The dashed orange lines are the spine folds; keep text inside the blue areas.")}</p>
    </Card>
  );
}
