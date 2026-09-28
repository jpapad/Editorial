"use client";

import { useState } from "react";
import Card from "@/components/studio/ui/Card";
import ColorSwatch from "@/components/studio/ui/ColorSwatch";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";

interface PaletteSwatch {
  hex: string;
  cmyk: string;
}

const MEADOW_SWATCHES: PaletteSwatch[] = [
  { hex: "#E4B7A0", cmyk: "0/24/34/4" },
  { hex: "#CFA77E", cmyk: "0/16/38/15" },
  { hex: "#8FAE8B", cmyk: "27/0/29/16" },
  { hex: "#5D7F6F", cmyk: "37/0/23/38" },
  { hex: "#D9CF9E", cmyk: "3/1/24/15" },
  { hex: "#B98A8A", cmyk: "0/17/17/27" },
  { hex: "#7B8FA8", cmyk: "22/13/0/34" },
  { hex: "#42505F", cmyk: "31/16/0/63" },
  { hex: "#EFE6DA", cmyk: "0/6/13/6" },
  { hex: "#C9C2B6", cmyk: "0/3/8/21" },
  { hex: "#8C7A6B", cmyk: "0/13/23/45" },
];

const OTHER_PALETTES = [
  { name: "Tide Pools", swatchCount: 4, preview: ["#7b8fa8", "#42505f", "#8fae8b", "#efe6da"] },
  { name: "Crayon box", swatchCount: 8, kidSafe: true, preview: ["#e4b7a0", "#d9cf9e", "#8fae8b", "#b98a8a"] },
];

/** 1h: palettes, restyled to the light shell. Expanded active palette with hex+CMYK readout, collapsed rows for the book's other palettes, "extract from an image" entry point. */
export default function PalettesScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = MEADOW_SWATCHES[selectedIndex];

  return (
    <div className="flex flex-col gap-4" style={{ width: 560 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-modal-title font-semibold tracking-[-0.02em] text-ink">Palettes</p>
          <MetaLabel>Shared across this book</MetaLabel>
        </div>
        <Button variant="primary" size="sm">
          New palette
        </Button>
      </div>

      <Card className="flex flex-col gap-4 p-4" style={{ boxShadow: "0 0 0 2px var(--color-accent), var(--shadow-panel)" }}>
        <div className="flex items-center justify-between">
          <p className="text-card-title font-semibold text-ink">Meadow</p>
          <MetaLabel>11 swatches · in use on 14 pages</MetaLabel>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {MEADOW_SWATCHES.map((swatch, i) => (
            <ColorSwatch key={swatch.hex} hex={swatch.hex} sizePx={34} selected={i === selectedIndex} onClick={() => setSelectedIndex(i)} />
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-hairline pt-3">
          <MetaLabel tone="ink">
            {selected.hex.replace("#", "")} · CMYK {selected.cmyk}
          </MetaLabel>
          <button type="button" className="text-helper font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            Edit swatch
          </button>
        </div>
      </Card>

      {OTHER_PALETTES.map((palette) => (
        <Card key={palette.name} className="flex items-center gap-3 p-3.5">
          <div className="flex gap-1">
            {palette.preview.map((hex) => (
              <span key={hex} className="h-6 w-6 rounded-row-sm" style={{ backgroundColor: hex }} aria-hidden />
            ))}
          </div>
          <p className="flex-1 text-body font-medium text-ink">{palette.name}</p>
          <MetaLabel>{palette.kidSafe ? "Kid-safe" : `${palette.swatchCount} swatches`}</MetaLabel>
        </Card>
      ))}

      <button
        type="button"
        className="rounded-panel-sm border border-dashed border-hairline px-4 py-3 text-left text-body text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Extract palette from an image
      </button>
    </div>
  );
}
