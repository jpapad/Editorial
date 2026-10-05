// Renders public/icon.svg to the PNG app icons (manifest + Apple touch icon)
// with Playwright's Chromium — no image library needed. Run after changing
// the SVG: node scripts/build-icons.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const svg = fs.readFileSync(path.join(root, "public/icon.svg"), "utf8");
const targets = [
  ["public/icon-192.png", 192, 0],
  ["public/icon-512.png", 512, 0],
  // Maskable: the artwork inside the 80% safe circle, on the brand color.
  ["public/icon-maskable-512.png", 512, 0.1],
  ["public/apple-touch-icon.png", 180, 0],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, inset] of targets) {
  await page.setViewportSize({ width: size, height: size });
  const pad = Math.round(size * inset);
  await page.setContent(`<html><body style="margin:0;background:${inset ? "#3357d4" : "transparent"}"><div style="padding:${pad}px;width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace("<svg ", `<svg width="${size - pad * 2}" height="${size - pad * 2}" `)}</div></body></html>`);
  await page.screenshot({ path: path.join(root, file), omitBackground: !inset });
  console.log(`${file} ${size}×${size}`);
}
await browser.close();
