import { Button, Card, MetaLabel } from "@pagewright/ui";

/** A settings card from the editor's right panel. Padding comes from the caller. */
export const SettingsPanel = () => (
  <Card className="flex w-[264px] flex-col gap-2.5 p-4">
    <div className="flex items-center justify-between">
      <p className="text-card-title font-semibold text-ink">Book print</p>
      <MetaLabel>8.5 × 11 in</MetaLabel>
    </div>
    <p className="text-helper text-ink-muted">White margin around every page. Turn on bleed for art that runs off the edge.</p>
    <Button variant="secondary" size="sm">Amazon listing kit</Button>
  </Card>
);

/** tone="accent": the light-blue advisory tint for hints and checks. */
export const AccentAdvisory = () => (
  <Card tone="accent" className="flex w-[264px] flex-col gap-1.5 p-4">
    <MetaLabel tone="accent">Print check</MetaLabel>
    <p className="text-body text-ink">2 pages have art inside the trim margin. KDP may reject the file.</p>
  </Card>
);

/** radius="panel-sm" for denser lists. */
export const CompactList = () => (
  <Card radius="panel-sm" className="flex w-[264px] flex-col p-1.5">
    {["Page 1 · Cover", "Page 2 · Maze", "Page 3 · Dot-to-dot"].map((row, i) => (
      <div key={row} className={i === 1 ? "rounded-row-sm bg-accent-tint px-3 py-2 text-body text-ink" : "rounded-row-sm px-3 py-2 text-body text-ink-secondary"}>
        {row}
      </div>
    ))}
  </Card>
);
