import { MetaLabel } from "@pagewright/ui";

/** Uppercase mono metadata under titles: counts, sizes, status. */
export const UnderTitle = () => (
  <div className="flex flex-col gap-0.5">
    <h1 className="text-page-title font-semibold tracking-[-0.02em] text-ink">All books</h1>
    <MetaLabel>12 books · 284 pages</MetaLabel>
  </div>
);

export const Tones = () => (
  <div className="flex flex-col gap-2">
    <MetaLabel tone="muted">Autosaved 2m ago</MetaLabel>
    <MetaLabel tone="ink">Page 07 / 24</MetaLabel>
    <MetaLabel tone="accent">3 of 20 AI credits left</MetaLabel>
    <MetaLabel tone="warning">2 warnings</MetaLabel>
    <MetaLabel tone="error">1 blocking issue</MetaLabel>
  </div>
);

export const InCardHeader = () => (
  <div className="flex w-[264px] items-center justify-between rounded-panel bg-panel p-4 shadow-panel">
    <p className="text-card-title font-semibold text-ink">Trim size</p>
    <MetaLabel>8.5 × 11 in</MetaLabel>
  </div>
);
