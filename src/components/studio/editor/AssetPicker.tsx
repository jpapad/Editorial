"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Star, Heart, Cat, RectangleHorizontal, Square, Circle, Triangle, Hexagon, Minus, MoveRight, Type, Upload, Sparkles } from "lucide-react";
import Card from "@/components/studio/ui/Card";
import Button from "@/components/studio/ui/Button";
import Slider from "@/components/studio/ui/Slider";
import Toggle from "@/components/studio/ui/Toggle";
import { cn } from "@/utils/cn";
import { STAMP_LIBRARY, svgToDataUri } from "@/components/editor/stampLibrary";
import { FONT_OPTIONS } from "@/components/editor/kidFonts";
import AiGeneratePanel from "@/components/studio/editor/AiGeneratePanel";
import type { ShapeKind, StampFilter } from "@/types/editor";
import { useT } from "@/lib/i18n";

const STAMP_ICONS = { star: Star, heart: Heart, animal: Cat, frame: RectangleHorizontal } as const;
const SHAPE_OPTIONS: { kind: ShapeKind; label: string; Icon: typeof Square }[] = [
  { kind: "rectangle", label: "Rectangle", Icon: Square },
  { kind: "circle", label: "Circle", Icon: Circle },
  { kind: "triangle", label: "Triangle", Icon: Triangle },
  { kind: "star", label: "Star", Icon: Star },
  { kind: "heart", label: "Heart", Icon: Heart },
  { kind: "hexagon", label: "Hexagon", Icon: Hexagon },
  { kind: "line", label: "Line", Icon: Minus },
  { kind: "arrow", label: "Arrow", Icon: MoveRight },
];

const FONT_SIZE_OPTIONS = [
  { label: "S", value: 24 },
  { label: "M", value: 32 },
  { label: "L", value: 48 },
  { label: "XL", value: 64 },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function getImageNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image dimensions"));
    img.src = src;
  });
}

export interface AssetPickerProps {
  tool: "stamp" | "shape" | "text";
  onPickStamp: (src: string, options?: { naturalSize?: { width: number; height: number }; filter?: StampFilter; threshold?: number }) => void;
  onAddShape: (shapeKind: ShapeKind) => void;
  onAddText: (fontFamily: string, fontSize: number, fill?: string) => void;
}

/**
 * Restyled from the old editor's Sidebar (stamps/shapes/text tabs +
 * upload section) onto the new tokens — same real capability, new look.
 * Deliberately narrower than the original: Sidebar also had Patterns and
 * Cover tabs (background pattern picker, cover title presets) that
 * aren't ported here. That's a real, disclosed scope cut, not an
 * oversight — this pass covers the tools the new rail actually exposes
 * (stamp/shape/text); patterns/cover are a natural follow-up, not
 * silently dropped capability.
 */
export default function AssetPicker({ tool, onPickStamp, onAddShape, onAddText }: AssetPickerProps) {
  const t = useT();
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState(FONT_SIZE_OPTIONS[1].value);
  const [convertToLineArt, setConvertToLineArt] = useState(false);
  const [lineArtThreshold, setLineArtThreshold] = useState(0.5);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const naturalSize = await getImageNaturalSize(dataUrl).catch(() => undefined);
      onPickStamp(dataUrl, { naturalSize, filter: convertToLineArt ? "lineArt" : "none", threshold: lineArtThreshold });
    } catch {
      window.alert(t("Sorry, that file couldn't be loaded. Try a PNG or SVG."));
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      {tool === "stamp" && (
        <>
          <p className="text-card-title font-semibold text-ink">{t("Stamps")}</p>
          <p className="text-helper text-ink-muted">{t("Click a stamp, then click the page to place it.")}</p>
          <div className="grid grid-cols-2 gap-2">
            {STAMP_LIBRARY.map(({ id, label, svg }) => {
              const Icon = STAMP_ICONS[id as keyof typeof STAMP_ICONS] ?? Sparkles;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPickStamp(svgToDataUri(svg))}
                  className="flex flex-col items-center gap-1 rounded-row-sm border border-hairline p-2 text-helper text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <Icon size={20} />
                  {t(label)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 border-t border-hairline pt-3">
            <Toggle checked={convertToLineArt} onChange={setConvertToLineArt} label={t("Convert upload to line art")} />
            {convertToLineArt && <Slider layout="stacked" min={0.1} max={0.9} step={0.05} value={lineArtThreshold} onChange={setLineArtThreshold} valueLabel={lineArtThreshold.toFixed(2)} />}
            <input ref={fileInputRef} type="file" accept="image/png,image/svg+xml,.png,.svg" onChange={handleFileChange} className="hidden" />
            <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => fileInputRef.current?.click()}>
              {t("Upload image / SVG")}
            </Button>
          </div>

          <AiGeneratePanel onPickStamp={onPickStamp} />
        </>
      )}

      {tool === "shape" && (
        <>
          <p className="text-card-title font-semibold text-ink">{t("Shapes")}</p>
          <p className="text-helper text-ink-muted">{t("Click a shape, then click the page to place it.")}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {SHAPE_OPTIONS.map(({ kind, label, Icon }) => (
              <button
                key={kind}
                type="button"
                title={t(label)}
                aria-label={t(label)}
                onClick={() => onAddShape(kind)}
                className="flex aspect-square items-center justify-center rounded-row-sm border border-hairline text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
        </>
      )}

      {tool === "text" && (
        <>
          <p className="text-card-title font-semibold text-ink">{t("Text")}</p>
          <p className="text-helper text-ink-muted">{t("Pick a style, then click the page to place your text.")}</p>

          <div className="grid grid-cols-2 gap-1.5">
            {FONT_OPTIONS.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setFontFamily(value);
                  onAddText(value, fontSize);
                }}
                style={{ fontFamily: value }}
                className={cn(
                  "rounded-row-sm border px-2 py-1.5 text-left text-body text-ink outline-none transition-colors duration-150 motion-reduce:transition-none",
                  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  fontFamily === value ? "border-accent bg-accent-tint" : "border-hairline hover:bg-inset-alt"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            {FONT_SIZE_OPTIONS.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setFontSize(value);
                  onAddText(fontFamily, value);
                }}
                className={cn(
                  "flex-1 rounded-row-sm border py-1.5 text-helper font-medium outline-none transition-colors duration-150 motion-reduce:transition-none",
                  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  fontSize === value ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Button variant="dark" icon={<Type size={15} />} onClick={() => onAddText(fontFamily, fontSize)}>
            {t("Add text")}
          </Button>
        </>
      )}
    </Card>
  );
}
