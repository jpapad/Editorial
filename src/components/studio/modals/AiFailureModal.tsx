import Button from "@/components/studio/ui/Button";
import Card from "@/components/studio/ui/Card";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import StatusDot from "@/components/studio/ui/StatusDot";

export interface Remedy {
  label: string;
  onApply?: () => void;
}

export interface AiFailureModalProps {
  cause?: string;
  explanation?: string;
  prompt?: string;
  remedies?: Remedy[];
  onRetry?: () => void;
}

const DEFAULT_REMEDIES: Remedy[] = [{ label: "Δοκίμασε με «Medium» γραμμή" }, { label: "Χώρισέ το σε 2 σελίδες" }];

/**
 * 3d: AI failure (460x440). README: "Never show a raw error code; always
 * offer a remedy and refund the credit" — both are structural guarantees
 * here, not just copy: there's no error-code prop at all (only cause/
 * explanation strings meant for people), and the credit-not-charged
 * label is unconditional, not tied to some error-type check that could
 * be wrong.
 */
export default function AiFailureModal({
  cause = "Το prompt ζητά πολλή λεπτομέρεια για βάρος γραμμής «Bold»",
  explanation = "Οι χοντρές γραμμές κλείνουν τα μικρά σχήματα. Δοκίμασε λιγότερη λεπτομέρεια ή λεπτότερη γραμμή.",
  prompt = "δάσος με εκατοντάδες φύλλα, λεπτές νεράιδες, χοντρό περίγραμμα",
  remedies = DEFAULT_REMEDIES,
  onRetry,
}: AiFailureModalProps) {
  return (
    <div className="flex flex-col gap-4 rounded-panel bg-panel p-5 shadow-panel" style={{ width: 460, height: 440 }}>
      <p className="text-modal-title font-semibold tracking-[-0.02em] text-ink">Δεν μπόρεσα να φτιάξω αυτή τη σελίδα</p>

      <Card className="flex items-start gap-2.5 p-3.5">
        <StatusDot tone="error" className="mt-1.5" />
        <div>
          <p className="text-body font-medium text-ink">{cause}</p>
          <p className="mt-1 text-helper text-ink-secondary">{explanation}</p>
        </div>
      </Card>

      <Card className="p-3.5">
        <MetaLabel>Το prompt σου</MetaLabel>
        <p className="mt-1.5 text-body text-ink-secondary">{prompt}</p>
      </Card>

      <div className="flex flex-1 flex-col gap-2">
        {remedies.map((remedy) => (
          <Card key={remedy.label} tone="accent" className="flex items-center justify-between px-3.5 py-2.5">
            <p className="text-body text-ink">{remedy.label}</p>
            <button type="button" onClick={remedy.onApply} className="text-body font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              Εφαρμογή
            </button>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="dark" onClick={onRetry}>
          Δοκίμασε ξανά
        </Button>
        <MetaLabel>Δεν χρεώθηκε credit</MetaLabel>
      </div>
    </div>
  );
}
