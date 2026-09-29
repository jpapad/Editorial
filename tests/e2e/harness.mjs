// Shared helpers for the browser tests. Each test prints PASS/FAIL lines
// and exits non-zero if any check failed; run.mjs runs them all.
import fs from "node:fs";
import { chromium } from "playwright";

export const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const OUT = new URL("./.output/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

/** Where a screenshot goes (tests/e2e/.output/, git-ignored). */
export const shot = (name) => OUT + name;

export function check(cond, name, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) process.exitCode = 1;
}

export const launch = () => chromium.launch();

/**
 * A page with its own error log (`page.errors`). `lang` is written to
 * localStorage before the app loads; null keeps the app default (Greek).
 * Dialogs are dismissed (or accepted with `acceptDialogs`) and recorded
 * in `page.dialogs`.
 */
export async function newPage(target, { lang = "en", viewport = { width: 1440, height: 960 }, acceptDialogs = false, ...options } = {}) {
  const page = "newContext" in target ? await target.newPage({ viewport, ...options }) : await target.newPage();
  if (lang) await page.addInitScript((l) => localStorage.setItem("pagewright-lang", l), lang);
  page.errors = [];
  page.dialogs = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("dialog", (d) => {
    page.dialogs.push(d.message());
    void (acceptDialogs ? d.accept() : d.dismiss());
  });
  return page;
}

/** Open the signed-out local editor at / and wait for the canvas. */
export async function openEditor(page, query = "") {
  await page.goto(`${BASE}/${query}`);
  await page.waitForSelector("canvas", { timeout: 30000 });
  await page.waitForTimeout(1500);
  return page.locator("canvas").first().boundingBox();
}

/** Drag the pointer through `pts` (canvas-relative), one stroke. */
export async function draw(page, cb, pts, steps = 10) {
  await page.mouse.move(cb.x + pts[0][0], cb.y + pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(cb.x + x, cb.y + y, { steps });
  await page.mouse.up();
}

/** Non-transparent pixels on the paint (coloring) layer. */
export const paintedPixels = (page) =>
  page.evaluate(() => {
    const img = window.Konva.stages[0].find("Image").find((i) => i.image() instanceof HTMLCanvasElement);
    const c = img.image();
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });

/** Objects on the ink layer (strokes, shapes, text…), ignoring the transformer. */
export const inkNodes = (page) => page.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").getChildren().filter((n) => n.getClassName() !== "Transformer").length);

/** The canvas size in page points (stage size / zoom). */
export const nativeSize = (page) =>
  page.evaluate(() => {
    const s = window.Konva.stages[0];
    return [Math.round(s.width() / s.scaleX()), Math.round(s.height() / s.scaleY())];
  });

export function noPageErrors(...pages) {
  const errors = pages.flatMap((p) => p.errors);
  check(errors.length === 0, "no page errors", errors.join(" | ").slice(0, 400));
}
