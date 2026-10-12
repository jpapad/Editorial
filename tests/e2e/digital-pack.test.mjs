// The digital download pack: one ZIP with a PNG per page, a PDF per paper size, LICENSE and READ-ME.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { launch, newPage, openEditor, check, draw, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const side = (name) => p.getByRole("button", { name, exact: true });

await draw(p, cb, [[150, 200], [350, 260], [250, 420]]);
await p.getByRole("button", { name: "Add page" }).click();
await p.getByRole("button", { name: /Full Drawing Page/ }).click();
await p.waitForTimeout(400);
await draw(p, cb, [[200, 300], [400, 500]]);

await side("Digital download pack").scrollIntoViewIfNeeded();
await side("Digital download pack").click();
const dialog = p.getByRole("dialog");
check(await dialog.getByText("One ZIP to upload to Etsy").isVisible(), "the pack dialog opens");
await dialog.getByRole("radio", { name: "Commercial use" }).click();
await dialog.getByLabel("Shop or author name (for the license)").fill("Maria's Prints");
const [download] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }), dialog.getByRole("button", { name: "Download ZIP" }).click()]);
await dialog.waitFor({ state: "detached", timeout: 30000 });
const zipPath = shot("pack.zip");
await download.saveAs(zipPath);
check(/-printables\.zip$/.test(download.suggestedFilename()), "the download is a printables ZIP", download.suggestedFilename());

const list = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
if (list.error) console.log("SKIP unzip not installed");
else {
  const names = list.stdout.trim().split("\n");
  check(spawnSync("unzip", ["-tq", zipPath]).status === 0, "the ZIP is valid");
  check(names.some((n) => n.endsWith("/pages/page-01.png")) && names.some((n) => n.endsWith("/pages/page-02.png")), "one PNG per page, in order", names.join(", "));
  check(names.some((n) => n.endsWith("-A4.pdf")) && names.some((n) => n.endsWith("-US-Letter.pdf")), "both PDFs are inside");
  // Page widths of a PDF inside the ZIP, from its MediaBoxes.
  const widths = (suffix) => [...spawnSync("unzip", ["-p", zipPath, names.find((n) => n.endsWith(suffix))]).stdout.toString("latin1").matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((m) => Math.round(Number(m[1].trim().split(/\s+/)[2])));
  const a4 = widths("-A4.pdf");
  const letter = widths("-US-Letter.pdf");
  check(a4.length === 2 && a4.every((w) => w === 595) && letter.length === 2 && letter.every((w) => w === 612), "an A4 and a Letter PDF, each with both pages", JSON.stringify({ a4, letter }));
  const license = spawnSync("unzip", ["-p", zipPath, names.find((n) => n.endsWith("LICENSE.txt"))], { encoding: "utf8" }).stdout;
  check(license.includes("Maria's Prints") && license.includes("Commercial use"), "the license names the shop and the chosen license");
  const png = spawnSync("unzip", ["-p", zipPath, names.find((n) => n.endsWith("page-01.png"))]).stdout;
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  check(png.subarray(1, 4).toString() === "PNG" && width === 2550 && height === 3300, "pages are 300 DPI PNGs at the trim size (8.5 × 11 in)", `${width}×${height}`);
}
fs.rmSync(zipPath, { force: true });
noPageErrors(p);
await b.close();
