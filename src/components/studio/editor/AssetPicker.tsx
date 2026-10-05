"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Star, Heart, Cat, RectangleHorizontal, Square, Circle, Triangle, Hexagon, Minus, MoveRight, Type, Upload, Sparkles, X } from "lucide-react";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import type { MyStamp } from "@/utils/myStamps";
import { filterMedia, type MediaFilter, type MediaItem, type MediaSource } from "@/utils/mediaLibrary";
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
  onPickStamp: (src: string, options?: { naturalSize?: { width: number; height: number }; filter?: StampFilter; threshold?: number }, media?: { name?: string; source: MediaSource }) => void;
  onAddShape: (shapeKind: ShapeKind) => void;
  onAddText: (fontFamily: string, fontSize: number, fill?: string) => void;
  /** Pieces the user saved from a selection ("Save to my stamps"). */
  myStamps?: MyStamp[];
  onPlaceMyStamp?: (stamp: MyStamp) => void;
  onDeleteMyStamp?: (id: string) => void;
  /** The media library: every picture uploaded or generated. Null = not available (signed out, not set up). */
  media?: MediaItem[] | null;
  onDeleteMedia?: (item: MediaItem) => void;
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
export default function AssetPicker({ tool, onPickStamp, onAddShape, onAddText, myStamps = [], onPlaceMyStamp, onDeleteMyStamp, media = null, onDeleteMedia }: AssetPickerProps) {
  const t = useT();
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState(FONT_SIZE_OPTIONS[1].value);
  const [convertToLineArt, setConvertToLineArt] = useState(false);
  const [lineArtThreshold, setLineArtThreshold] = useState(0.5);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [mediaQuery, setMediaQuery] = useState("");
  const shownMedia = media ? filterMedia(media, mediaFilter, mediaQuery) : [];

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const naturalSize = await getImageNaturalSize(dataUrl).catch(() => undefined);
      onPickStamp(dataUrl, { naturalSize, filter: convertToLineArt ? "lineArt" : "none", threshold: lineArtThreshold }, { name: file.name, source: "upload" });
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

          {media && (
            <div className="flex flex-col gap-2 border-t border-hairline pt-3">
              <div className="flex items-center justify-between">
                <MetaLabel>{t("My pictures")}</MetaLabel>
                <MetaLabel>{media.length}</MetaLabel>
              </div>
              {media.length === 0 ? (
                <p className="text-helper text-ink-muted">{t("Every picture you upload or make with AI is kept here, to use again in any book.")}</p>
              ) : (
                <>
                  <div className="flex gap-1" role="radiogroup" aria-label={t("Show")}>
                    {(
                      [
                        ["all", t("All")],
                        ["upload", t("Uploads")],
                        ["ai", t("AI")],
                      ] as [MediaFilter, string][]
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={mediaFilter === value}
                        onClick={() => setMediaFilter(value)}
                        className={`flex-1 rounded-pill border px-2 py-0.5 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent ${mediaFilter === value ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {media.length > 9 && (
                    <input value={mediaQuery} onChange={(e) => setMediaQuery(e.target.value)} placeholder={t("Search by name")} aria-label={t("Search by name")} className="h-8 rounded-row-sm border border-hairline bg-panel px-2 text-helper text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent" />
                  )}
                  {shownMedia.length === 0 ? (
                    <p className="text-helper text-ink-muted">{t("Nothing matches.")}</p>
                  ) : (
                    <ul className="grid max-h-[264px] grid-cols-3 gap-1.5 overflow-y-auto p-0.5" aria-label={t("My pictures")}>
                      {shownMedia.map((item) => (
                        <li key={item.id} className="group relative">
                          <button
                            type="button"
                            aria-label={t("Use {name}", { name: item.name })}
                            title={item.name}
                            onClick={() => onPickStamp(item.url, item.width && item.height ? { naturalSize: { width: item.width, height: item.height } } : undefined)}
                            className="flex aspect-square w-full items-center justify-center rounded-row-sm border border-hairline bg-white p-1 outline-none hover:border-ink-muted focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- the user's own file in Storage */}
                            <img src={item.url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("Delete {name}", { name: item.name })}
                            onClick={() => onDeleteMedia?.(item)}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-panel text-ink-muted opacity-0 shadow-resting outline-none hover:text-error focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100"
                          >
                            <X size={11} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-hairline pt-3">
            <MetaLabel>{t("My stamps")}</MetaLabel>
            {myStamps.length === 0 ? (
              <p className="text-helper text-ink-muted">{t("Select something on the page and press “Save to my stamps” to keep it here for any book.")}</p>
            ) : (
              <ul className="grid grid-cols-3 gap-1.5" aria-label={t("My stamps")}>
                {myStamps.map((stamp) => (
                  <li key={stamp.id} className="group relative">
                    <button
                      type="button"
                      aria-label={t("Place {name}", { name: stamp.name })}
                      title={stamp.name}
                      onClick={() => onPlaceMyStamp?.(stamp)}
                      className="flex aspect-square w-full items-center justify-center rounded-row-sm border border-hairline bg-white p-1 outline-none hover:border-ink-muted focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL */}
                      <img src={stamp.preview} alt="" className="max-h-full max-w-full object-contain" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("Delete {name}", { name: stamp.name })}
                      onClick={() => onDeleteMyStamp?.(stamp.id)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-panel text-ink-muted opacity-0 shadow-resting outline-none hover:text-error focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100"
                    >
                      <X size={11} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
