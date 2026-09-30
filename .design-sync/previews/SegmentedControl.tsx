import { useState } from "react";
import { SegmentedControl } from "@pagewright/ui";

/** The editor's mode switch. Keep labels short. */
export const EditorModes = () => {
  const [mode, setMode] = useState<"draw" | "color" | "cover">("draw");
  return (
    <SegmentedControl
      options={[
        { value: "draw", label: "Draw" },
        { value: "color", label: "Color" },
        { value: "cover", label: "Cover" },
      ]}
      value={mode}
      onChange={setMode}
    />
  );
};

export const TwoOptions = () => {
  const [v, setV] = useState<"fill" | "brush">("brush");
  return (
    <SegmentedControl
      options={[
        { value: "fill", label: "Fill" },
        { value: "brush", label: "Brush" },
      ]}
      value={v}
      onChange={setV}
    />
  );
};

export const Difficulty = () => {
  const [v, setV] = useState<"easy" | "medium" | "hard">("medium");
  return (
    <SegmentedControl
      options={[
        { value: "easy", label: "Easy" },
        { value: "medium", label: "Medium" },
        { value: "hard", label: "Hard" },
      ]}
      value={v}
      onChange={setV}
    />
  );
};
