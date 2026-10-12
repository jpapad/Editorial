// Export waits for every page's pictures. Pictures are Storage links that load
// only once their page is shown; capturing a page right after switching to it
// used to print the caption without the picture. Here each picture arrives
// 1.5 s late, and every page of the PDF must still carry it.
import fs from "node:fs";
import zlib from "node:zlib";
import { BASE, launch, newPage, check, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow, TEST_USER } from "./mockSupabase.mjs";

const PNG = fs.readFileSync(new URL("../../public/icon-maskable-512.png", import.meta.url));
const supabaseBase = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1].replace(/\/$/, "");
const picture = (i) => `${supabaseBase}/storage/v1/object/public/book-images/${TEST_USER.id}/picture-${i}.png`;
const pages = [1, 2, 3, 4].map((i) => ({
  id: `p${i}`,
  pageNumber: i,
  space: { width: 612, height: 792, bleed: 0 },
  lines: [],
  objects: [
    { kind: "stamp", id: `s${i}`, src: picture(i), x: 156, y: 150, width: 300, height: 300, rotation: 0, scaleX: 1, scaleY: 1 },
    { kind: "text", id: `t${i}`, text: `Page ${i}`, x: 106, y: 680, width: 400, height: 50, fontSize: 36, fontFamily: "Arial", align: "center", fill: "#111827", isDragging: false, rotation: 0, scaleX: 1, scaleY: 1 },
  ],
}));

/**
 * Every RGB page image in a PDF, decoded, with its alpha (PDFKit keeps a
 * PNG's alpha as a separate gray /SMask image). Flate, plus PNG predictors
 * when PDFKit passed the PNG's own data through.
 */
function pdfImages(buf) {
  const text = buf.toString("latin1");
  const objects = new Map();
  for (const m of text.matchAll(/(\d+) 0 obj\s*<<([^]*?)>>\s*stream\r?\n/g)) {
    const dict = m[2];
    if (!/\/Subtype\s*\/Image/.test(dict)) continue;
    const width = Number(/\/Width (\d+)/.exec(dict)[1]);
    const height = Number(/\/Height (\d+)/.exec(dict)[1]);
    const length = Number(/\/Length (\d+)/.exec(dict)[1]);
    const channels = /\/DeviceGray/.test(dict) ? 1 : 3;
    const start = m.index + m[0].length;
    let data = zlib.inflateSync(buf.subarray(start, start + length));
    if (/\/Predictor/.test(dict)) {
      // PNG row filters.
      const bpp = channels;
      const stride = width * channels;
      const rows = Buffer.alloc(stride * height);
      for (let y = 0; y < height; y++) {
        const type = data[y * (stride + 1)];
        for (let x = 0; x < stride; x++) {
          const raw = data[y * (stride + 1) + 1 + x];
          const a = x >= bpp ? rows[y * stride + x - bpp] : 0;
          const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
          const c = x >= bpp && y > 0 ? rows[(y - 1) * stride + x - bpp] : 0;
          const p = a + b - c;
          const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
          rows[y * stride + x] = (raw + [0, a, b, (a + b) >> 1, paeth][type]) & 255;
        }
      }
      data = rows;
    }
    objects.set(m[1], { width, height, channels, data, smask: /\/SMask (\d+) 0 R/.exec(dict)?.[1] });
  }
  return [...objects.values()].filter((o) => o.channels === 3).map((o) => ({ ...o, alpha: o.smask ? objects.get(o.smask)?.data : undefined }));
}

/** Share of visibly colored pixels where the picture sits (300×300pt at 156,150 on a 612×792 page); see-through counts as paper. */
function pictureCoverage({ width, height, data, alpha }) {
  let colored = 0;
  let seen = 0;
  for (let y = Math.round(height * (170 / 792)); y < height * (430 / 792); y += 6)
    for (let x = Math.round(width * (176 / 612)); x < width * (436 / 612); x += 6) {
      const i = (y * width + x) * 3;
      seen++;
      if ((alpha ? alpha[y * width + x] >= 128 : true) && Math.min(data[i], data[i + 1], data[i + 2]) < 200) colored++;
    }
  return colored / seen;
}

const b = await launch();
const p = await newPage(b, { acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
const db = await mockSupabase(p, { books: [bookRow({ title: "Late pictures", pages })] });
db.storage = Object.fromEntries([1, 2, 3, 4].map((i) => [`book-images/${TEST_USER.id}/picture-${i}.png`, { type: "image/png", body: PNG }]));
// Registered after the mock, so it runs first: hold every picture back before Storage answers.
await p.route(`${supabaseBase}/storage/v1/object/public/**`, async (route) => {
  await new Promise((r) => setTimeout(r, 1500));
  await route.fallback();
});
let pdf = null;
p.on("download", async (d) => (pdf = fs.readFileSync(await d.path())));

await p.goto(`${BASE}/studio/editor?book=${bookRow().id}`);
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1000);
await p.getByRole("button", { name: "Export", exact: true }).first().click();
await p.waitForTimeout(800);
const modal = p.locator("div.fixed.inset-0.z-50");
if (await modal.getByRole("button", { name: "Export", exact: true }).count()) await modal.getByRole("button", { name: "Export", exact: true }).click();
for (let i = 0; i < 240 && !pdf; i++) await p.waitForTimeout(250);

check(pdf !== null, "the PDF downloads");
const images = pdf ? pdfImages(pdf) : [];
const coverage = images.map(pictureCoverage);
check(images.length === 4, "one page image per page", String(images.length));
check(coverage.length === 4 && coverage.every((c) => c > 0.3), "every page carries its picture, not just its caption", coverage.map((c) => c.toFixed(2)).join(", "));
noPageErrors(p);
await b.close();
