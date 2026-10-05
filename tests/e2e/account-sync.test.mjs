// Signed in: my stamps and versions go to the account (and reach another device); pictures are saved as links.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const BOOK = "22222222-2222-4222-8222-222222222222";
const space = { width: 612, height: 792, bleed: 0 };
const star = { kind: "shape", id: "s1", shapeKind: "star", x: 200, y: 250, width: 120, height: 120, rotation: 0, scaleX: 1, scaleY: 1, fill: "#ffffff", stroke: "#111827", strokeWidth: 6 };
const db = { books: [bookRow({ id: BOOK, title: "Synced", trim_size: "8.5x11", pages: [{ id: "p1", pageNumber: 1, space, lines: [], objects: [star] }] })], comments: [], stamps: [], versions: [], storage: {} };
const open = async (ctxPage) => {
  await ctxPage.goto(`${BASE}/studio/editor?book=${BOOK}`);
  await ctxPage.waitForSelector("canvas", { timeout: 30000 });
  await ctxPage.waitForTimeout(1500);
  return ctxPage.locator("canvas").first().boundingBox();
};

// ---- device A
const a = await newPage(b);
await mockSupabase(a, { db });
const cb = await open(a);
const scale = await a.evaluate(() => window.Konva.stages[0].scaleX());
await a.mouse.click(cb.x + 260 * scale, cb.y + 310 * scale);
await a.waitForTimeout(300);
await a.getByRole("toolbar", { name: "Selection actions" }).getByRole("button", { name: "Save to my stamps" }).click();
await a.waitForTimeout(800);
check(db.stamps.length === 1 && db.stamps[0].objects.length === 1 && db.stamps[0].preview.startsWith("data:image/png"), "saving a stamp while signed in stores it with the account");

const versions = a.getByRole("button", { name: "Version history" });
await versions.scrollIntoViewIfNeeded();
await versions.click();
await a.getByRole("dialog").getByRole("button", { name: "Save a version now" }).click();
await a.waitForTimeout(800);
check(db.versions.some((v) => v.book_id === BOOK && v.manual && v.pages.length === 1), "a version saved by hand goes to the account too");
await a.getByRole("dialog").getByRole("button", { name: "Close" }).click();

// A big picture on the page: after autosave the saved book holds a link, the file is in storage.
const png = Buffer.from(
  await a.evaluate(() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 500;
    const x = cv.getContext("2d");
    for (let i = 0; i < 4000; i++) {
      x.fillStyle = `rgb(${(i * 37) % 255},${(i * 91) % 255},${(i * 53) % 255})`;
      x.fillRect((i * 13) % 500, (i * 29) % 500, 9, 9);
    }
    return cv.toDataURL("image/png").split(",")[1];
  }),
  "base64"
);
await a.keyboard.press("s");
await a.locator('input[type="file"][accept*="svg"]').setInputFiles({ name: "noise.png", mimeType: "image/png", buffer: png });
await a.waitForTimeout(400);
await a.mouse.click(cb.x + 300 * scale, cb.y + 560 * scale);
await a.waitForTimeout(4500); // autosave
const saved = db.books.find((bk) => bk.id === BOOK).pages[0].objects.find((o) => o.kind === "stamp");
const files = Object.keys(db.storage);
check(Boolean(saved) && /^http.*\/storage\/v1\/object\/public\/book-images\/.+\.png$/.test(saved.src), "the saved book holds a link to the picture, not the picture itself", saved?.src.slice(0, 90));
check(files.length === 1 && files[0].startsWith("book-images/11111111-1111-4111-8111-111111111111/") && db.storage[files[0]].body.length === png.length, "the picture file is in the user's own storage folder, byte for byte");
const live = await a.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("Image").filter((n) => n.name() !== "paint").map((n) => n.image()?.src.slice(0, 22))[0]);
check(live === "data:image/png;base64,", "the open editor keeps working with its own copy");
noPageErrors(a);
await a.context().close();

// ---- device B: a fresh browser, same account
const c = await newPage(b);
await mockSupabase(c, { db });
await open(c);
const shown = await c.evaluate(async () => {
  const img = window.Konva.stages[0].findOne(".ink-layer").find("Image").filter((n) => n.name() !== "paint")[0]?.image();
  return img ? { src: img.src.slice(0, 5), w: img.naturalWidth } : null;
});
check(shown?.src.startsWith("http") && shown.w === 500, "on another device the picture loads from its link", JSON.stringify(shown));
// Export still works with a linked picture (the canvas must not be tainted).
const exportable = await c.evaluate(() => { try { return window.Konva.stages[0].toDataURL().length > 1000; } catch (e) { return String(e); } });
check(exportable === true, "a page with a linked picture can still be exported", String(exportable));
await c.keyboard.press("s");
await c.waitForTimeout(600);
check((await c.getByRole("list", { name: "My stamps" }).getByRole("listitem").count()) === 1, "the stamp saved on the first device is here");
await c.screenshot({ path: shot("account-sync.png") });
const v2 = c.getByRole("button", { name: "Version history" });
await c.keyboard.press("v");
await v2.scrollIntoViewIfNeeded();
await v2.click();
const dialog = c.getByRole("dialog");
await dialog.getByRole("listitem").first().waitFor({ timeout: 5000 });
check(await dialog.getByText(/from your account/).first().isVisible(), "so is the saved version, marked as coming from the account");
// Delete everything on the page, then restore the account version.
await dialog.getByRole("listitem").filter({ hasText: "saved by you" }).first().getByRole("button", { name: "Restore" }).click();
await c.waitForTimeout(800);
const after = await c.evaluate(() => ({ stars: window.Konva.stages[0].findOne(".ink-layer").find("Line").filter((l) => l.closed()).length, images: window.Konva.stages[0].findOne(".ink-layer").find("Image").filter((n) => n.name() !== "paint").length }));
check(after.stars === 1 && after.images === 0, "restoring it brings back the book as it was then (before the picture was added)", JSON.stringify(after));
// Deleting the stamp here removes it from the account.
await c.keyboard.press("s");
await c.getByRole("list", { name: "My stamps" }).getByRole("listitem").hover();
await c.getByRole("button", { name: /^Delete Stamp/ }).click();
await c.waitForTimeout(600);
check(db.stamps.length === 0, "deleting a stamp removes it from the account");
check(c.dialogs.length === 0, "no alerts");
noPageErrors(c);
await b.close();
