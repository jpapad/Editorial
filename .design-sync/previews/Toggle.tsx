import { useState } from "react";
import { Toggle } from "@pagewright/ui";

/** Settings switches with labels, stacked in a panel. */
export const SettingsList = () => {
  const [bleed, setBleed] = useState(true);
  const [despeckle, setDespeckle] = useState(false);
  const [shading, setShading] = useState(true);
  return (
    <div className="flex w-[264px] flex-col gap-3 rounded-panel bg-panel p-4 shadow-panel">
      <Toggle checked={bleed} onChange={setBleed} label="Print to the edge (bleed)" />
      <Toggle checked={despeckle} onChange={setDespeckle} label="Despeckle" />
      <Toggle checked={shading} onChange={setShading} label="Keep shading" />
    </div>
  );
};

export const OnOff = () => (
  <div className="flex items-center gap-6">
    <Toggle checked={false} onChange={() => {}} label="Off" />
    <Toggle checked onChange={() => {}} label="On" />
  </div>
);
