"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { colorPreview } from "@/components/studio/editor/regions";

type Scene = "book" | "flatlay" | "fan";
const SCENES: Scene[] = ["book", "flatlay", "fan"];
const BACKGROUNDS = ["#f6e7d8", "#dfeaf5", "#e4efdc", "#f3dfe6", "#2b2d42"];
const CRAYONS = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"];
const SIZE = 1600;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("unreadable page"));
    img.src = src;
  });
}

/** The page as a child might have coloured it (see regions.ts), as a canvas. */
function colored(img: HTMLImageElement, seed: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.round(img.naturalWidth * k);
  canvas.height = Math.round(img.naturalHeight * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = colorPreview({ width: pixels.width, height: pixels.height, data: pixels.data }, seed);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0);
  return canvas;
}

type Art = HTMLImageElement | HTMLCanvasElement;
const ratio = (a: Art) => (a instanceof HTMLImageElement ? a.naturalWidth / a.naturalHeight : a.width / a.height);

/** A sheet of paper lying on the table: centred at (cx, cy), `h` tall, turned by `deg`, with a soft shadow. */
function sheet(ctx: CanvasRenderingContext2D, art: Art, cx: number, cy: number, h: number, deg: number) {
  const w = h * ratio(art);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  ctx.drawImage(art, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function crayon(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, deg: number, color: string) {
  const t = length * 0.13;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(0, -t / 2, length * 0.84, t, t * 0.18);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.beginPath();
  ctx.moveTo(length * 0.84, -t * 0.42);
  ctx.lineTo(length, 0);
  ctx.lineTo(length * 0.84, t * 0.42);
  ctx.closePath();
  ctx.fill();
  // The paper wrapper.
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillRect(length * 0.2, -t / 2, length * 0.44, t);
  ctx.restore();
}

/** A standing paperback seen slightly from the left: the cover sheared a little, a spine, a shadow on the floor. */
function book(ctx: CanvasRenderingContext2D, cover: Art, dark: boolean) {
  const h = SIZE * 0.66;
  const w = h * ratio(cover);
  const spine = Math.max(26, w * 0.06);
  const x = (SIZE - w - spine) / 2 + spine;
  const y = (SIZE - h) / 2 - 20;
  const shear = -0.045;
  // Floor shadow.
  ctx.save();
  ctx.fillStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.2)";
  ctx.filter = "blur(26px)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 30, y + h + 28, w * 0.62, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Spine: the page edge in shade.
  ctx.save();
  ctx.transform(1, 0.16, 0, 1, x - spine, y - spine * 0.16 + 0);
  ctx.fillStyle = "#d9d4cb";
  ctx.fillRect(0, 0, spine, h);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let i = 3; i < spine; i += 4) ctx.fillRect(i, 0, 1, h);
  ctx.restore();
  // Cover.
  ctx.save();
  ctx.transform(1, shear, 0, 1, x, y);
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 18;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.shadowColor = "transparent";
  ctx.drawImage(cover, 0, 0, w, h);
  // A sheen down the binding edge.
  const sheen = ctx.createLinearGradient(0, 0, w * 0.12, 0);
  sheen.addColorStop(0, "rgba(0,0,0,0.16)");
  sheen.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w * 0.12, h);
  ctx.restore();
}

function draw(canvas: HTMLCanvasElement, scene: Scene, background: string, pages: HTMLImageElement[], seed: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx || pages.length === 0) return;
  canvas.width = canvas.height = SIZE;
  const dark = background === BACKGROUNDS[4];
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // A soft pool of light so the table isn't flat.
  const light = ctx.createRadialGradient(SIZE * 0.4, SIZE * 0.35, 80, SIZE / 2, SIZE / 2, SIZE * 0.8);
  light.addColorStop(0, "rgba(255,255,255,0.4)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const at = (i: number) => pages[Math.min(i, pages.length - 1)];
  if (scene === "book") book(ctx, at(0), dark);
  else if (scene === "flatlay") {
    sheet(ctx, at(2), SIZE * 0.36, SIZE * 0.47, SIZE * 0.62, -9);
    sheet(ctx, colored(at(1), seed), SIZE * 0.6, SIZE * 0.53, SIZE * 0.66, 6);
    CRAYONS.forEach((c, i) => crayon(ctx, SIZE * 0.08 + i * 26, SIZE * 0.86 - i * 14, SIZE * 0.3, -24 + i * 9, c));
  } else {
    sheet(ctx, at(1), SIZE * 0.25, SIZE * 0.52, SIZE * 0.54, -11);
    sheet(ctx, at(2), SIZE * 0.75, SIZE * 0.52, SIZE * 0.54, 11);
    sheet(ctx, colored(at(0), seed), SIZE * 0.5, SIZE * 0.5, SIZE * 0.62, 0);
  }
}

/**
 * Ready-made listing pictures from the book's own pages: a standing book,
 * a flat lay with crayons and a half-coloured page, and a fan of pages.
 * `images` are page renders in book order (the first is used as the cover).
 */
export default function MockupDialog({ images, fileName, onClose }: { images: string[] | null; fileName: string; onClose: () => void }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pages, setPages] = useState<HTMLImageElement[] | null>(null);
  const [scene, setScene] = useState<Scene>("book");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!images) return;
    let alive = true;
    Promise.all(images.map(load)).then(
      (loaded) => alive && setPages(loaded),
      () => alive && setFailed(true)
    );
    return () => {
      alive = false;
    };
  }, [images]);

  useEffect(() => {
    if (canvasRef.current && pages) draw(canvasRef.current, scene, background, pages, 3);
  }, [pages, scene, background]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${fileName}-mockup-${scene}.png`;
    link.click();
  }

  const label: Record<Scene, string> = { book: t("Standing book"), flatlay: t("On the table, with crayons"), fan: t("Three pages") };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mk-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-full w-[560px] max-w-full flex-col gap-3 rounded-panel bg-panel p-5 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="mk-title" className="text-modal-title font-semibold tracking-[-0.02em] text-ink">
            {t("Listing mockups")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        <div role="radiogroup" aria-label={t("Scene")} className="flex gap-1.5">
          {SCENES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scene === s}
              onClick={() => setScene(s)}
              className={cn("flex-1 rounded-pill border px-2 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", scene === s ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt")}
            >
              {label[s]}
            </button>
          ))}
        </div>
        <div className="relative flex aspect-square min-h-0 w-full items-center justify-center overflow-hidden rounded-row bg-inset">
          <canvas ref={canvasRef} aria-label={t("Mockup preview")} className="h-full w-full" />
          {!pages && !failed && (
            <span className="absolute flex items-center gap-2 text-body text-ink-secondary">
              <Loader2 size={16} className="animate-spin" /> {t("Rendering your pages…")}
            </span>
          )}
          {failed && <span className="absolute text-body text-error">{t("The pages could not be rendered.")}</span>}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5" role="group" aria-label={t("Background color")}>
            {BACKGROUNDS.map((c) => (
              <button key={c} type="button" aria-label={c} aria-pressed={background === c} onClick={() => setBackground(c)} className={cn("h-7 w-7 rounded-pill border outline-none focus-visible:ring-2 focus-visible:ring-accent", background === c ? "border-accent ring-2 ring-accent" : "border-hairline")} style={{ background: c }} />
            ))}
          </div>
          <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={download} disabled={!pages}>
            {t("Download PNG")}
          </Button>
        </div>
        <p className="text-helper text-ink-muted">{t("1600 × 1600 px, made from your first pages (page 1 is the cover). The colors are only an example of a finished page.")}</p>
      </div>
    </div>
  );
}
