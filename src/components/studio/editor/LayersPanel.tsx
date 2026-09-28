import { Lock } from "lucide-react";
import Card from "@/components/studio/ui/Card";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import type { Layer } from "@/components/studio/types";

export interface LayersPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
}

/** Layers card (2b): swatch + name + mono meta per row, active row tinted. Line art is always locked by default (README, Interactions & behavior) — shown as a lock glyph instead of a percentage for that row. */
export default function LayersPanel({ layers, activeLayerId, onSelectLayer }: LayersPanelProps) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-card-title font-semibold text-ink">Layers</p>
        <MetaLabel>{layers.filter((l) => l.visible).length} visible</MetaLabel>
      </div>

      {layers.map((layer) => {
        const active = layer.id === activeLayerId;
        return (
          <button
            key={layer.id}
            type="button"
            onClick={() => onSelectLayer(layer.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-row-sm px-2 py-2 text-left outline-none transition-colors duration-150 motion-reduce:transition-none",
              "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              active ? "bg-accent-tint" : "hover:bg-inset-alt"
            )}
          >
            <span className="h-[26px] w-[26px] shrink-0 rounded-paper-sm" style={{ backgroundColor: layer.previewColor }} aria-hidden />
            <span className="flex-1 text-body text-ink">{layer.name}</span>
            {layer.locked ? <Lock size={12} className="text-ink-muted" /> : <MetaLabel>{layer.opacity}%</MetaLabel>}
          </button>
        );
      })}
    </Card>
  );
}
