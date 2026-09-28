import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { PLACEHOLDER_ART_PATTERN } from "@/components/studio/ui/Thumbnail";

export type AiTileStatus = "done" | "rendering" | "queued";

export interface AiTile {
  status: AiTileStatus;
  progressPct?: number;
}

export interface AiGeneratingModalProps {
  tiles?: AiTile[];
  etaLabel?: string;
  onBackground?: () => void;
  onStop?: () => void;
}

const DEFAULT_TILES: AiTile[] = [{ status: "done" }, { status: "done" }, { status: "rendering", progressPct: 58 }, { status: "queued" }];

function Tile({ tile }: { tile: AiTile }) {
  if (tile.status === "queued") {
    return (
      <div className="flex items-center justify-center rounded-paper-sm bg-inset">
        <MetaLabel>Σε αναμονή</MetaLabel>
      </div>
    );
  }

  if (tile.status === "rendering") {
    return (
      <div className="relative flex flex-col items-center justify-center gap-2 rounded-paper-sm bg-inset-alt p-3">
        <div className="h-1 w-full rounded-pill bg-inset">
          <div className="h-1 rounded-pill bg-accent transition-[width] duration-200" style={{ width: `${tile.progressPct ?? 0}%` }} />
        </div>
        <MetaLabel>Γραμμές {tile.progressPct ?? 0}%</MetaLabel>
      </div>
    );
  }

  return <div className="rounded-paper-sm" style={{ backgroundImage: PLACEHOLDER_ART_PATTERN }} />;
}

/** 3c: AI generating (460x440) — 4 tiles streaming in independently (queued -> rendering with % -> done). Must survive navigating away (README) — that's a real background-job requirement for whichever service backs this; not something a static screen build can demonstrate on its own. */
export default function AiGeneratingModal({ tiles = DEFAULT_TILES, etaLabel = "~20 ΔΕΥΤ.", onBackground, onStop }: AiGeneratingModalProps) {
  return (
    <div className="flex flex-col gap-4 rounded-panel bg-panel p-5 shadow-panel" style={{ width: 460, height: 440 }}>
      <div className="flex items-center justify-between">
        <p className="text-modal-title font-semibold tracking-[-0.02em] text-ink">Δημιουργία 4 επιλογών</p>
        <MetaLabel>{etaLabel}</MetaLabel>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3">
        {tiles.map((tile, i) => (
          <Tile key={i} tile={tile} />
        ))}
      </div>

      <p className="text-helper text-ink-secondary">Μπορείς να συνεχίσεις να σχεδιάζεις — θα σου πούμε μόλις είναι έτοιμο.</p>

      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={onBackground} className="flex-1">
          Στο παρασκήνιο
        </Button>
        <Button variant="ghost" onClick={onStop}>
          Διακοπή
        </Button>
      </div>
    </div>
  );
}
