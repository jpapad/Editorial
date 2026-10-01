"use client";

import { useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Frame,
  Group,
  Image as ImageIcon,
  Lock,
  LockOpen,
  ScanSearch,
  Shapes,
  Trash2,
  Type,
  Ungroup,
} from "lucide-react";
import Card from "@/components/studio/ui/Card";
import Button from "@/components/studio/ui/Button";
import ColorSwatch from "@/components/studio/ui/ColorSwatch";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Toggle from "@/components/studio/ui/Toggle";
import AssetPicker from "@/components/studio/editor/AssetPicker";
import { BACKGROUND_PATTERNS, svgToDataUri } from "@/components/editor/backgroundPatterns";
import { FRAMES, frameDataUri } from "@/components/editor/frameLibrary";
import { FONT_OPTIONS } from "@/components/editor/kidFonts";
import { cn } from "@/utils/cn";
import { useT, type TFunction } from "@/lib/i18n";
import type { AlignEdge } from "@/utils/objectGeometry";
import type { MyStamp } from "@/utils/myStamps";
import type { EditorMode } from "@/components/studio/types";
import type { BookPage, DrawingTool, FillStyle, ObjectChanges, PageObject, ShapeKind, StampFilter, TextData } from "@/types/editor";
import FillStylePicker from "@/components/studio/editor/FillStylePicker";
import { AGE_GROUPS, type AgeCheckResult, type AgeGroup } from "@/components/studio/editor/ageCheck";

const PALETTE = ["#111827", "#e4b7a0", "#cfa77e", "#8fae8b", "#5d7f6f", "#d9cf9e", "#b98a8a", "#7b8fa8", "#42505f", "#ffffff"];

const TITLE_PRESETS = [
  { label: "Playful", fontFamily: FONT_OPTIONS[0].value, fontSize: 72, fill: "#111827" },
  { label: "Elegant", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 64, fill: "#111827" },
  { label: "Bold Pop", fontFamily: FONT_OPTIONS[3].value, fontSize: 80, fill: "#be123c" },
];

const ALIGN_BUTTONS: { edge: AlignEdge; label: string; Icon: typeof AlignStartVertical }[] = [
  { edge: "left", label: "Align left", Icon: AlignStartVertical },
  { edge: "center-x", label: "Align centers horizontally", Icon: AlignCenterVertical },
  { edge: "right", label: "Align right", Icon: AlignEndVertical },
  { edge: "top", label: "Align top", Icon: AlignStartHorizontal },
  { edge: "center-y", label: "Align middles vertically", Icon: AlignCenterHorizontal },
  { edge: "bottom", label: "Align bottom", Icon: AlignEndHorizontal },
];

export interface RightPanelProps {
  mode: EditorMode;
  tool: DrawingTool;
  activeColor: string;
  onSelectColor: (hex: string) => void;
  fillStyle: FillStyle;
  onFillStyleChange: (style: FillStyle) => void;
  page: BookPage;
  selectedIds: string[];
  onSelectObject: (id: string | null, additive: boolean) => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAlign: (edge: AlignEdge) => void;
  onDistribute: (axis: "x" | "y") => void;
  onFlip: (direction: "horizontal" | "vertical") => void;
  onGroup: () => void;
  onUngroup: () => void;
  onToggleObjectFlag: (id: string, flag: "locked" | "hidden") => void;
  onMoveObject: (id: string, toIndex: number) => void;
  onUpdateSelectedText: (changes: ObjectChanges) => void;
  onPickStamp: (src: string, options?: { naturalSize?: { width: number; height: number }; filter?: StampFilter; threshold?: number }) => void;
  onAddShape: (shapeKind: ShapeKind) => void;
  onAddText: (fontFamily: string, fontSize: number, fill?: string) => void;
  myStamps?: MyStamp[];
  onPlaceMyStamp?: (stamp: MyStamp) => void;
  onDeleteMyStamp?: (id: string) => void;
  onSetBackgroundPattern: (patternId: string | null) => void;
  onSetFrame: (frameId: string | null) => void;
  onToggleCover: () => void;
  onSetCoverBackgroundColor: (color: string) => void;
  /** null = no check run for the current page state. */
  gapCount: number | null;
  onRunGapCheck: () => void;
  onClearGapCheck: () => void;
  /** Adds pen strokes that seal the gaps found. */
  onCloseGaps: () => void;
  ageGroup: AgeGroup;
  /** null = not checked for the current page state. */
  ageResult: AgeCheckResult | null;
  onRunAgeCheck: (group: AgeGroup) => void;
  onClearAgeCheck: () => void;
  /** Extra cards at the bottom (book print settings, the cover card). */
  /** Shown first, above everything else (the readiness score). */
  leadCard?: React.ReactNode;
  extraCards?: React.ReactNode;
}

const ICON_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-row-sm text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset-alt disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={ICON_BUTTON}>
      {children}
    </button>
  );
}

function objectLabel(obj: PageObject, t: TFunction): string {
  if (obj.kind === "text") return obj.text.replace(/\s+/g, " ").trim() || t("Text");
  if (obj.kind === "shape") return t(obj.shapeKind[0].toUpperCase() + obj.shapeKind.slice(1));
  return obj.isFrame ? t("Frame") : (obj.label ?? t("Image"));
}

function ObjectIcon({ obj }: { obj: PageObject }) {
  const Icon = obj.kind === "text" ? Type : obj.kind === "shape" ? Shapes : obj.isFrame ? Frame : ImageIcon;
  return <Icon size={13} className="shrink-0 text-ink-muted" aria-hidden />;
}

/** Selection actions: stacking, alignment, flipping, grouping, and text styling when text is selected. */
function SelectionCard(props: RightPanelProps & { selected: PageObject[] }) {
  const t = useT();
  const { selected } = props;
  const count = selected.length;
  const texts = selected.filter((o): o is TextData => o.kind === "text");
  const anyGrouped = selected.some((o) => o.groupId);

  if (count === 0) {
    return (
      <Card className="flex flex-col gap-1.5 p-4">
        <p className="text-card-title font-semibold text-ink">{t("Selection")}</p>
        <p className="text-helper text-ink-muted">{t("Click an object to select it. Shift-click or drag a box to select several.")}</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-card-title font-semibold text-ink">{t("Selection")}</p>
        <MetaLabel>{count === 1 ? objectLabel(selected[0], t).slice(0, 18) : t("{n} objects", { n: count })}</MetaLabel>
      </div>

      <div className="flex flex-col gap-1">
        <MetaLabel>{count === 1 ? t("Align to page") : t("Align")}</MetaLabel>
        <div className="flex flex-wrap items-center">
          {ALIGN_BUTTONS.map(({ edge, label, Icon }) => (
            <IconButton key={edge} label={t(label)} onClick={() => props.onAlign(edge)}>
              <Icon size={14} />
            </IconButton>
          ))}
          <span className="mx-px h-5 w-px bg-hairline" />
          <IconButton label={t("Distribute horizontally")} onClick={() => props.onDistribute("x")} disabled={count < 3}>
            <AlignHorizontalDistributeCenter size={15} />
          </IconButton>
          <IconButton label={t("Distribute vertically")} onClick={() => props.onDistribute("y")} disabled={count < 3}>
            <AlignVerticalDistributeCenter size={15} />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 border-t border-hairline pt-2">
        <IconButton label={t("Bring forward")} onClick={props.onBringForward}>
          <ArrowUp size={15} />
        </IconButton>
        <IconButton label={t("Send backward")} onClick={props.onSendBackward}>
          <ArrowDown size={15} />
        </IconButton>
        <IconButton label={t("Flip horizontally")} onClick={() => props.onFlip("horizontal")}>
          <FlipHorizontal2 size={15} />
        </IconButton>
        <IconButton label={t("Flip vertically")} onClick={() => props.onFlip("vertical")}>
          <FlipVertical2 size={15} />
        </IconButton>
        <IconButton label={`${t("Group")} (⌘/Ctrl G)`} onClick={props.onGroup} disabled={count < 2}>
          <Group size={15} />
        </IconButton>
        <IconButton label={`${t("Ungroup")} (⌘/Ctrl Shift G)`} onClick={props.onUngroup} disabled={!anyGrouped}>
          <Ungroup size={15} />
        </IconButton>
        <IconButton label={`${t("Duplicate")} (⌘/Ctrl D)`} onClick={props.onDuplicate}>
          <Copy size={15} />
        </IconButton>
        <IconButton label={t("Delete")} onClick={props.onDelete}>
          <Trash2 size={15} className="text-error" />
        </IconButton>
      </div>

      {texts.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-hairline pt-3">
          <MetaLabel>{t("Text")}</MetaLabel>
          <select
            aria-label={t("Font")}
            value={FONT_OPTIONS.some((f) => f.value === texts[0].fontFamily) ? texts[0].fontFamily : ""}
            onChange={(e) => props.onUpdateSelectedText({ fontFamily: e.target.value })}
            className="h-8 rounded-row-sm border border-hairline bg-panel px-2 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ fontFamily: texts[0].fontFamily }}
          >
            {!FONT_OPTIONS.some((f) => f.value === texts[0].fontFamily) && <option value="">{t("Custom font")}</option>}
            {FONT_OPTIONS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <Toggle checked={texts.every((x) => x.outline)} onChange={(outline) => props.onUpdateSelectedText({ outline })} label={t("Outline letters (colorable)")} />
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => props.onUpdateSelectedText({ align })}
                className={cn(
                  "flex-1 rounded-row-sm border py-1 text-helper capitalize outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  texts[0].align === align ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt"
                )}
              >
                {t(align[0].toUpperCase() + align.slice(1))}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Every object on the page, front-most first: click to select, eye to hide, padlock to lock, drag to restack. */
function LayersCard({ page, selectedIds, onSelectObject, onToggleObjectFlag, onMoveObject }: RightPanelProps) {
  const t = useT();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null); // display index the dragged row would land before
  const rows = [...page.objects].reverse();
  const n = page.objects.length;

  if (n === 0) return null;

  function drop() {
    if (!dragId || dropSlot === null) return;
    const fromDisplay = rows.findIndex((o) => o.id === dragId);
    const slot = dropSlot > fromDisplay ? dropSlot - 1 : dropSlot;
    onMoveObject(dragId, n - 1 - slot);
  }

  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-card-title font-semibold text-ink">{t("Layers")}</p>
        <MetaLabel>{t("{n} objects", { n })}</MetaLabel>
      </div>
      <ul
        className="flex max-h-56 flex-col overflow-y-auto"
        onDragOver={(e) => dragId && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          drop();
          setDragId(null);
          setDropSlot(null);
        }}
      >
        {rows.map((obj, displayIndex) => {
          const selected = selectedIds.includes(obj.id);
          return (
            <li
              key={obj.id}
              draggable
              onDragStart={(e) => {
                setDragId(obj.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", obj.id);
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setDropSlot(e.clientY < rect.top + rect.height / 2 ? displayIndex : displayIndex + 1);
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropSlot(null);
              }}
              className={cn(
                "relative flex items-center gap-1.5 rounded-row-sm pl-1.5 pr-0.5",
                selected ? "bg-accent-tint" : "hover:bg-inset-alt",
                dragId === obj.id && "opacity-40",
                obj.hidden && "opacity-60"
              )}
            >
              {dragId && dropSlot === displayIndex && <span className="absolute inset-x-1 -top-px h-0.5 rounded-pill bg-accent" aria-hidden />}
              {dragId && dropSlot === displayIndex + 1 && displayIndex === rows.length - 1 && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-pill bg-accent" aria-hidden />}
              {obj.groupId && <span className="h-4 w-0.5 shrink-0 rounded-pill bg-accent/60" title={t("Grouped")} aria-hidden />}
              <button
                type="button"
                onClick={(e) => !obj.hidden && !obj.locked && onSelectObject(obj.id, e.shiftKey)}
                className="flex min-w-0 flex-1 cursor-grab items-center gap-2 py-1.5 text-left text-body text-ink outline-none focus-visible:underline"
              >
                <ObjectIcon obj={obj} />
                <span className="truncate">{objectLabel(obj, t)}</span>
              </button>
              <button
                type="button"
                aria-label={obj.hidden ? t("Show {name}", { name: objectLabel(obj, t) }) : t("Hide {name}", { name: objectLabel(obj, t) })}
                title={obj.hidden ? t("Show (it's left out of the export while hidden)") : t("Hide")}
                onClick={() => onToggleObjectFlag(obj.id, "hidden")}
                className={cn(ICON_BUTTON, "h-7 w-7", obj.hidden && "text-ink")}
              >
                {obj.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                type="button"
                aria-label={obj.locked ? t("Unlock {name}", { name: objectLabel(obj, t) }) : t("Lock {name}", { name: objectLabel(obj, t) })}
                title={obj.locked ? t("Unlock") : t("Lock (can't be moved or selected on the page)")}
                onClick={() => onToggleObjectFlag(obj.id, "locked")}
                className={cn(ICON_BUTTON, "h-7 w-7", obj.locked && "text-ink")}
              >
                {obj.locked ? <Lock size={13} /> : <LockOpen size={13} />}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function GapCheckRow({ gapCount, onRunGapCheck, onClearGapCheck, onCloseGaps }: Pick<RightPanelProps, "gapCount" | "onRunGapCheck" | "onClearGapCheck" | "onCloseGaps">) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="secondary" size="sm" icon={<ScanSearch size={13} />} onClick={onRunGapCheck}>
        {t("Check lines for gaps")}
      </Button>
      {gapCount !== null && (
        <div className={cn("flex items-start justify-between gap-2 rounded-row-sm px-2.5 py-2 text-helper", gapCount > 0 ? "bg-error/10 text-error" : "bg-success/15 text-ink-secondary")}>
          <span>{gapCount > 0 ? t(gapCount === 1 ? "1 possible gap circled in red — the paint bucket would leak through. Close it with the pen." : "{n} possible gaps circled in red — the paint bucket would leak through. Close them with the pen.", { n: gapCount }) : t("No gaps found — every area fills on its own.")}</span>
          <button type="button" onClick={onClearGapCheck} className="shrink-0 font-medium underline-offset-2 outline-none hover:underline focus-visible:underline">
            {t("Hide")}
          </button>
        </div>
      )}
      {gapCount !== null && gapCount > 0 && (
        <Button variant="primary" size="sm" onClick={onCloseGaps}>
          {t("Close the gaps for me")}
        </Button>
      )}
    </div>
  );
}

/** "Is this page right for this age?" — areas and line thickness measured against the chosen age. */
function AgeCheckRow({ ageGroup, ageResult, onRunAgeCheck, onClearAgeCheck }: Pick<RightPanelProps, "ageGroup" | "ageResult" | "onRunAgeCheck" | "onClearAgeCheck">) {
  const t = useT();
  const tone = !ageResult ? "" : ageResult.verdict === "good" ? "bg-success/15 text-ink-secondary" : ageResult.verdict === "too-detailed" ? "bg-error/10 text-error" : "bg-warning/15 text-ink-secondary";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <select
          aria-label={t("Age group")}
          value={ageGroup}
          onChange={(e) => onRunAgeCheck(e.target.value as AgeGroup)}
          className="h-8 min-w-0 flex-1 rounded-row-sm border border-hairline bg-panel px-2 text-helper text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {AGE_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {t(g.label)}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={() => onRunAgeCheck(ageGroup)}>
          {t("Check age fit")}
        </Button>
      </div>
      {ageResult && (
        <div className={cn("flex flex-col gap-1 rounded-row-sm px-2.5 py-2 text-helper", tone)}>
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium">
              {ageResult.verdict === "good"
                ? t("Good fit for this age.")
                : ageResult.verdict === "too-detailed"
                  ? t("Too detailed for this age.")
                  : ageResult.verdict === "empty"
                    ? t("Nothing to check yet.")
                    : t("Mostly fine, with a few small areas.")}
            </span>
            <button type="button" onClick={onClearAgeCheck} className="shrink-0 font-medium underline-offset-2 outline-none hover:underline focus-visible:underline">
              {t("Hide")}
            </button>
          </div>
          {ageResult.verdict !== "empty" && (
            <span>{t("{areas} areas to color · {small} too small · lines ~{line}pt", { areas: ageResult.areas, small: ageResult.tooSmall.length, line: ageResult.lineWidth })}</span>
          )}
          {ageResult.advice.map((a) => (
            <span key={a}>• {t(a)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 264px fixed right column, scrollable when its cards outgrow the window.
 * Draw mode: palette, the tool's asset picker (stamp/shape/text) or the
 * selection + layers cards (select/pen/eraser), then page settings.
 * Color mode: palette, the fill tip and the gap check.
 */
export default function RightPanel(props: RightPanelProps) {
  const { mode, tool, activeColor, onSelectColor, page, selectedIds } = props;
  // The cover is drawn with the same tools as a page; only its settings card differs.
  const drawLike = mode === "draw" || mode === "cover";
  const showAssetPicker = drawLike && (tool === "stamp" || tool === "shape" || tool === "text");
  const selected = page.objects.filter((o) => selectedIds.includes(o.id));
  const currentFrame = page.objects.find((o) => o.kind === "stamp" && o.isFrame);
  const t = useT();

  return (
    <aside className="absolute bottom-[18px] right-[18px] top-[106px] flex w-[264px] flex-col gap-3.5 overflow-y-auto pb-1">
      {props.leadCard}
      <Card className="flex shrink-0 flex-col gap-3 p-4">
        <p className="text-card-title font-semibold text-ink">{t("Palette")}</p>
        <div className="grid grid-cols-6 gap-[7px]">
          {PALETTE.map((hex) => (
            <ColorSwatch key={hex} hex={hex} selected={hex === activeColor} onClick={() => onSelectColor(hex)} sizePx={28} context="panel" className={hex === "#ffffff" ? "border border-hairline" : undefined} />
          ))}
        </div>
        {mode === "color" && (
          <>
            <p className="text-helper text-ink-muted">{t("Color for the bucket and the brush.")}</p>
            <FillStylePicker value={props.fillStyle} color={activeColor} onChange={props.onFillStyleChange} />
          </>
        )}
      </Card>

      {showAssetPicker && (
        <div className="shrink-0">
          <AssetPicker tool={tool as "stamp" | "shape" | "text"} onPickStamp={props.onPickStamp} onAddShape={props.onAddShape} onAddText={props.onAddText} myStamps={props.myStamps} onPlaceMyStamp={props.onPlaceMyStamp} onDeleteMyStamp={props.onDeleteMyStamp} />
        </div>
      )}

      {drawLike && !showAssetPicker && (
        <div className="flex shrink-0 flex-col gap-3.5">
          <SelectionCard {...props} selected={selected} />
          <LayersCard {...props} />
        </div>
      )}

      {mode === "color" && (
        <Card tone="accent" className="flex shrink-0 flex-col gap-2 p-4">
          <p className="text-card-title font-semibold text-ink">{t("Tip")}</p>
          <p className="text-helper text-ink-secondary">{t("Tap a closed shape to fill it. Hold to sample the color already there.")}</p>
          <MetaLabel tone="accent">{t("Long-press to sample")}</MetaLabel>
          <GapCheckRow {...props} />
        </Card>
      )}

      {mode === "draw" && (
        <Card className="flex shrink-0 flex-col gap-3 p-4">
          <p className="text-card-title font-semibold text-ink">{t("Page")}</p>

          <div>
            <MetaLabel>{t("Frame")}</MetaLabel>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => props.onSetFrame(null)}
                className={cn(
                  "flex aspect-[3/4] items-center justify-center rounded-row-sm border text-helper outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  !currentFrame ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-muted hover:bg-inset-alt"
                )}
              >
                {t("None")}
              </button>
              {FRAMES.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  title={t(frame.label)}
                  aria-label={t("{name} frame", { name: t(frame.label) })}
                  aria-pressed={currentFrame?.kind === "stamp" && currentFrame.frameId === frame.id}
                  onClick={() => props.onSetFrame(frame.id)}
                  className={cn(
                    "aspect-[3/4] rounded-row-sm border bg-white bg-contain bg-center bg-no-repeat p-1 outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    currentFrame?.kind === "stamp" && currentFrame.frameId === frame.id ? "border-accent ring-1 ring-accent" : "border-hairline hover:border-ink-muted"
                  )}
                  style={{ backgroundImage: `url("${frameDataUri(frame, 300, 400)}")`, backgroundOrigin: "content-box" }}
                />
              ))}
            </div>
          </div>

          <div>
            <MetaLabel>{t("Background pattern")}</MetaLabel>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => props.onSetBackgroundPattern(null)}
                className={cn(
                  "flex h-12 items-center justify-center rounded-row-sm border text-helper text-ink-muted outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  !page.backgroundPatternId ? "border-accent bg-accent-tint text-accent" : "border-hairline hover:bg-inset-alt"
                )}
              >
                {t("None")}
              </button>
              {BACKGROUND_PATTERNS.map((pattern) => (
                <button
                  key={pattern.id}
                  type="button"
                  onClick={() => props.onSetBackgroundPattern(pattern.id)}
                  title={t(pattern.label)}
                  aria-label={t(pattern.label)}
                  style={{ backgroundImage: `url(${svgToDataUri(pattern.svg)})`, backgroundSize: `${pattern.tileSize / 2}px ${pattern.tileSize / 2}px` }}
                  className={cn(
                    "h-12 rounded-row-sm border bg-white outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    page.backgroundPatternId === pattern.id ? "border-accent ring-1 ring-accent" : "border-hairline hover:border-ink-muted"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-hairline pt-3">
            <GapCheckRow {...props} />
            <AgeCheckRow {...props} />
          </div>

          <div className="flex flex-col gap-2 border-t border-hairline pt-3">
            <button
              type="button"
              onClick={props.onToggleCover}
              className={cn(
                "w-full rounded-row-sm border px-3 py-2 text-body font-medium outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                page.isCover ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt"
              )}
            >
              {page.isCover ? `✓ ${t("This page is the Book Cover")}` : t("Mark as Book Cover")}
            </button>

            {page.isCover && (
              <>
                <label className="flex items-center justify-between text-helper text-ink-secondary">
                  {t("Background color")}
                  <input
                    type="color"
                    value={page.coverBackgroundColor ?? "#ffffff"}
                    onChange={(e) => props.onSetCoverBackgroundColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded-row-sm border border-hairline"
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  {TITLE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => props.onAddText(preset.fontFamily, preset.fontSize, preset.fill)}
                      style={{ fontFamily: preset.fontFamily, color: preset.fill }}
                      className="rounded-row-sm border border-hairline px-2 py-2 text-left text-body font-semibold outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      {t("{style} Title", { style: t(preset.label) })}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      )}
      {props.extraCards}
    </aside>
  );
}
