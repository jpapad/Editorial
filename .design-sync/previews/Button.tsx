import { Download, Plus, RotateCcw, Upload } from "lucide-react";
import { Button } from "@pagewright/ui";

/** The library toolbar: primary action last, secondary before it. */
export const LibraryActions = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <Button variant="secondary" icon={<Upload size={14} />}>Import art</Button>
    <Button variant="primary" icon={<Plus size={14} />}>New book</Button>
  </div>
);

export const Variants = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    <Button variant="primary">Publish</Button>
    <Button variant="secondary">Cancel</Button>
    <Button variant="dark" icon={<RotateCcw size={14} />}>Try again</Button>
    <Button variant="ghost">Stop</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <Button size="md" icon={<Download size={14} />}>Export PDF</Button>
    <Button size="sm" variant="secondary" icon={<Download size={13} />}>Export cover PDF</Button>
  </div>
);

/** Disabled is its own fixed grey pill, not a faded accent. */
export const Disabled = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <Button disabled>Export</Button>
    <Button variant="secondary" disabled>Add spine title</Button>
  </div>
);
