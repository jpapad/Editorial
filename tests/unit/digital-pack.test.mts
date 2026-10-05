import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildZip, crc32, dataUrlBytes, pageFileName } from "../../src/utils/zip";
import { licenseText, packStem, readmeText, trimCrop } from "../../src/utils/digitalPack";
import { interiorSpace } from "../../src/utils/pageGeometry";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const t = (key: string, vars?: Record<string, string | number>) => key.replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? `{${k}}`));

// ---- zip
const enc = new TextEncoder();
ok(crc32(enc.encode("123456789")) === 0xcbf43926, "crc32 matches the standard check value");
const files = [
  { name: "βιβλίο/pages/page-01.png", data: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) },
  { name: "βιβλίο/LICENSE.txt", data: enc.encode("Για προσωπική χρήση\r\n") },
  { name: "βιβλίο/empty.txt", data: new Uint8Array(0) },
];
const zip = buildZip(files, new Date(2026, 9, 5, 12, 30, 10));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zip-test-"));
const zipPath = path.join(dir, "pack.zip");
fs.writeFileSync(zipPath, zip);
const test = spawnSync("unzip", ["-t", zipPath], { encoding: "utf8" });
if (test.error) console.log("SKIP unzip not installed");
else {
  ok(test.status === 0 && /No errors detected/.test(test.stdout), "unzip -t finds no errors (CRCs and offsets right)");
  const out = path.join(dir, "out");
  spawnSync("unzip", ["-q", zipPath, "-d", out]);
  ok(fs.readFileSync(path.join(out, "βιβλίο/LICENSE.txt"), "utf8") === "Για προσωπική χρήση\r\n", "Greek file names and contents come back intact");
  ok(fs.readFileSync(path.join(out, "βιβλίο/pages/page-01.png")).equals(Buffer.from(files[0].data)), "binary bytes come back intact");
}
fs.rmSync(dir, { recursive: true, force: true });

ok(dataUrlBytes("data:text/plain;base64,aGk=").join() === "104,105", "base64 data URL decodes");
ok(new TextDecoder().decode(dataUrlBytes("data:image/svg+xml;utf8,%3Csvg%3E")) === "<svg>", "percent-encoded data URL decodes");
ok(pageFileName(6, 40) === "page-07.png" && pageFileName(6, 120) === "page-007.png" && pageFileName(0, 3) === "page-01.png", "page file names are zero-padded to sort in order");

// ---- pack texts
ok(packStem("Ζωάκια της Φάρμας!") === "ζωακια-της-φαρμας", "Greek titles keep their letters, lose accents and punctuation");
ok(packStem("  ***  ") === "coloring-book", "an empty stem falls back to a default");
const personal = licenseText("personal", "Farm", "Maria's Prints", 2026, t);
const commercial = licenseText("commercial", "Farm", "", 2026, t);
ok(personal.includes("© 2026 Maria's Prints") && !personal.includes("sell or give away"), "personal license names the seller and doesn't allow selling");
ok(commercial.includes("the seller") && commercial.includes("sell or give away printed copies"), "commercial license allows printed copies, falls back to 'the seller'");
ok(licenseText("classroom", "Farm", "", 2026, t).includes("their own class"), "classroom license mentions the class");
const readme = readmeText("Farm", { pngs: true, sheets: ["a4", "letter"], license: "personal", seller: "" }, 24, t);
ok(readme.includes("A4 paper (24 pages)") && readme.includes("US Letter paper") && readme.includes("PNG, 300 DPI"), "readme lists the PDFs and the PNG folder");
ok(!readmeText("Farm", { pngs: false, sheets: ["a4"], license: "personal", seller: "" }, 5, t).includes("PNG"), "readme leaves out PNGs when they're not in the pack");

// ---- trim crop
const k = 300 / 72;
const noBleed = trimCrop(interiorSpace("8.5x11", false), k);
ok(noBleed.x === 0 && noBleed.width === Math.round(612 * k) && noBleed.height === Math.round(792 * k), "without bleed the PNG is the whole page");
const bleedSpace = interiorSpace("8.5x11", true);
const withBleed = trimCrop(bleedSpace, k);
ok(withBleed.x === Math.round(bleedSpace.bleed * k) && withBleed.width === Math.round(612 * k), "with bleed the band is cut off, the trim stays 8.5 in wide");

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
