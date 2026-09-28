"use client";

import { useState } from "react";
import Button from "@/components/studio/ui/Button";
import Toggle from "@/components/studio/ui/Toggle";
import Slider from "@/components/studio/ui/Slider";
import Card from "@/components/studio/ui/Card";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { PLACEHOLDER_ART_PATTERN } from "@/components/studio/ui/Thumbnail";

export interface ImportScanModalProps {
  fileName?: string;
  fileMeta?: string;
  onCancel?: () => void;
  onAdd?: () => void;
}

/**
 * 3b: import scan -> line art (780x520). Every slider/toggle here is real,
 * live state — but there's no actual image-tracing algorithm behind this
 * build (no source image was supplied either, per the handoff's fidelity
 * rule), so the "result" pane stays the striped placeholder regardless of
 * control values rather than faking a re-trace that isn't real. The
 * README's "re-traces the result pane live (debounce ~200ms)" behavior
 * would wire into here once a real tracer exists.
 */
export default function ImportScanModal({ fileName = "FOX_SKETCH.JPG", fileMeta = "2480 x 3508 · 300 DPI", onCancel, onAdd }: ImportScanModalProps) {
  const [threshold, setThreshold] = useState(0.42);
  const [lineWeight, setLineWeight] = useState(2.8);
  const [despeckle, setDespeckle] = useState(true);
  const [closeShapes, setCloseShapes] = useState(true);
  const [keepShading, setKeepShading] = useState(false);
  const [detail, setDetail] = useState(72);

  return (
    <div className="flex flex-col rounded-panel bg-panel shadow-panel" style={{ width: 780, height: 520 }}>
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <p className="text-modal-title font-semibold tracking-[-0.02em] text-ink">Μετατροπή σε line art</p>
          <MetaLabel>
            {fileName} · {fileMeta}
          </MetaLabel>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Άκυρο
          </Button>
          <Button variant="primary" onClick={onAdd}>
            Προσθήκη στο βιβλίο
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-1 gap-4 px-5 pb-5">
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex-1 rounded-paper-sm bg-[#e7e4df]" />
          <MetaLabel className="self-center">Πρωτότυπο</MetaLabel>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex-1 rounded-paper-sm" style={{ backgroundImage: PLACEHOLDER_ART_PATTERN, boxShadow: "0 0 0 2px var(--color-accent)" }} />
          <MetaLabel className="self-center">Αποτέλεσμα</MetaLabel>
        </div>

        {/* 264px, not the spec's literal 232px — the README's own "3g" note
            says to budget ~20% extra width for Greek in dense panels, and
            "ΔΙΑΤΗΡΗΣΗ ΛΕΠΤΟΜΕΡΕΙΑΣ" genuinely doesn't fit on one line at
            232px. The two preview panes are flex-1, so they absorb the
            difference automatically — total modal width stays 780. */}
        <Card className="flex w-[264px] shrink-0 flex-col gap-4 p-4">
          <Slider label="Κατώφλι" valueLabel={threshold.toFixed(2)} min={0} max={1} step={0.01} value={threshold} onChange={setThreshold} />
          <Slider label="Πάχος γραμμής" valueLabel={`${lineWeight.toFixed(1)} PT`} min={0.5} max={8} step={0.1} value={lineWeight} onChange={setLineWeight} />

          <div className="flex flex-col gap-2.5">
            <Toggle checked={despeckle} onChange={setDespeckle} label="Καθαρισμός κόκκου" />
            <Toggle checked={closeShapes} onChange={setCloseShapes} label="Κλείσιμο ανοιχτών σχημάτων" />
            <Toggle checked={keepShading} onChange={setKeepShading} label="Διατήρηση σκίασης" />
          </div>

          <div>
            <Slider label="Διατήρηση λεπτομέρειας" valueLabel={`${detail}%`} min={0} max={100} step={1} value={detail} onChange={setDetail} />
            <p className="mt-1.5 text-helper text-ink-muted">Χαμηλότερο = πιο καθαρές, πιο παιδικές γραμμές.</p>
          </div>

          <Card tone="accent" className="p-3">
            <p className="text-helper text-ink-secondary">Το «κλείσιμο σχημάτων» επιτρέπει το γέμισμα με ένα tap. Συνίσταται για παιδικές σελίδες.</p>
          </Card>
        </Card>
      </div>
    </div>
  );
}
