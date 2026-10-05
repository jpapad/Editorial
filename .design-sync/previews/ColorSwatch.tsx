import { useState } from "react";
import { ColorSwatch } from "@pagewright/ui";

const PALETTE = ["#f2c94c", "#f2994a", "#eb5757", "#bb6bd9", "#2f80ed", "#56ccf2", "#27ae60", "#8fae8b", "#cfa77e", "#10141a"];

/** A palette grid in a side panel; click to select. */
export const PanelPalette = () => {
  const [color, setColor] = useState("#2f80ed");
  return (
    <div className="grid grid-cols-5 gap-2.5 rounded-panel bg-panel p-4 shadow-panel" style={{ width: 216 }}>
      {PALETTE.map((hex) => (
        <ColorSwatch key={hex} hex={hex} selected={hex === color} onClick={() => setColor(hex)} />
      ))}
    </div>
  );
};

/** context="toolbar": a white gap before the ring, for use over colored content. */
export const FloatingToolbar = () => {
  const [color, setColor] = useState("#eb5757");
  return (
    <div className="inline-flex items-center gap-2.5 rounded-pill bg-panel px-3 py-2 shadow-toolbar">
      {["#eb5757", "#f2c94c", "#27ae60", "#2f80ed"].map((hex) => (
        <ColorSwatch key={hex} hex={hex} sizePx={38} context="toolbar" selected={hex === color} onClick={() => setColor(hex)} />
      ))}
    </div>
  );
};

export const Sizes = () => (
  <div className="flex items-center gap-3">
    <ColorSwatch hex="#8fae8b" sizePx={22} />
    <ColorSwatch hex="#8fae8b" sizePx={28} selected />
    <ColorSwatch hex="#8fae8b" sizePx={34} />
    <ColorSwatch hex="#8fae8b" sizePx={38} />
  </div>
);
