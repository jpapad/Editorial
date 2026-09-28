import { Plus } from "lucide-react";
import Card from "@/components/studio/ui/Card";
import ColorSwatch from "@/components/studio/ui/ColorSwatch";
import type { Palette } from "@/components/studio/types";

export interface PalettePanelProps {
  palette: Palette;
  activeSwatchHex: string;
  onSelectSwatch: (hex: string) => void;
  onAddSwatch: () => void;
}

/** Palette card (2b): 6-col grid of round swatches, 7px gap, ring on selected, palette name top-right. */
export default function PalettePanel({ palette, activeSwatchHex, onSelectSwatch, onAddSwatch }: PalettePanelProps) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-card-title font-semibold text-ink">Palette</p>
        <span className="text-helper text-accent">{palette.name}</span>
      </div>

      <div className="grid grid-cols-6 gap-[7px]">
        {palette.swatches.map((swatch) => (
          <ColorSwatch key={swatch.hex} hex={swatch.hex} selected={swatch.hex === activeSwatchHex} onClick={() => onSelectSwatch(swatch.hex)} sizePx={28} context="panel" />
        ))}
        <button
          type="button"
          aria-label="Add swatch"
          onClick={onAddSwatch}
          className="flex h-7 w-7 items-center justify-center rounded-pill bg-inset-alt text-ink-muted outline-none transition-colors duration-150 hover:bg-inset motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Plus size={14} />
        </button>
      </div>
    </Card>
  );
}
