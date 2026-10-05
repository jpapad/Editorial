import { useState } from "react";
import { Slider } from "@pagewright/ui";

/** Stacked (default): label and value above the track, one full-width row each. */
export const Stacked = () => {
  const [weight, setWeight] = useState(6);
  const [detail, setDetail] = useState(42);
  return (
    <div className="flex flex-col gap-4" style={{ width: 240 }}>
      <Slider label="Line weight" valueLabel={`${weight} PT`} min={1} max={16} value={weight} onChange={setWeight} />
      <Slider label="Detail" valueLabel={`${detail}%`} min={0} max={100} value={detail} onChange={setDetail} />
    </div>
  );
};

/** Inline: value beside a compact track, for toolbars. */
export const InlineToolbar = () => {
  const [size, setSize] = useState(12);
  return (
    <div className="inline-flex items-center gap-3 rounded-pill bg-panel px-4 py-2 shadow-toolbar">
      <Slider layout="inline" valueLabel={`${size} PX`} min={2} max={40} value={size} onChange={setSize} />
    </div>
  );
};

export const Extremes = () => (
  <div className="flex flex-col gap-4" style={{ width: 300 }}>
    <Slider label="Sensitivity" valueLabel="More lines" min={0} max={1} step={0.01} value={0.02} onChange={() => {}} />
    <Slider label="Sensitivity" valueLabel="Dark only" min={0} max={1} step={0.01} value={0.95} onChange={() => {}} />
  </div>
);
