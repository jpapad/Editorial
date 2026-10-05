// The media library: an uploaded picture is kept with the account and can be used again — in another book, on another device.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const A = "22222222-2222-4222-8222-222222222222";
const B = "33333333-3333-4333-8333-333333333333";
const space = { width: 612, height: 792, bleed: 0 };
const blank = (id) => [{ id, pageNumber: 1, space, lines: [], objects: [] }];
const db = { books: [bookRow({ id: A, title: "First", trim_size: "8.5x11", pages: blank("a1") }), bookRow({ id: B, title: "Second", trim_size: "8.5x11", pages: blank("b1") })], comments: [], storage: {}, media: [] };
const open = async (page, id) => {
  await page.goto(`${BASE}/studio/editor?book=${id}`);
  await page.waitForSelector("canvas", { timeout: 30000 });
  await page.waitForTimeout(1500);
  return page.locator("canvas").first().boundingBox();
};
const images = (page) => page.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("Image").filter((n) => n.name() !== "paint").map((n) => ({ src: n.image()?.src.slice(0, 5), w: n.image()?.naturalWidth })));

const p = await newPage(b);
await mockSupabase(p, { db });
let cb = await open(p, A);
await p.keyboard.press("s");
const list = () => p.getByRole("list", { name: "My pictures" });
check(await p.getByText("Every picture you upload or make with AI is kept here").isVisible(), "an empty library explains what it is for");

const png = Buffer.from(
  await p.evaluate(() => {
    const cv = document.createElement("canvas");
    cv.width = 400;
    cv.height = 300;
    const x = cv.getContext("2d");
    for (let i = 0; i < 3000; i++) {
      x.fillStyle = `rgb(${(i * 37) % 255},${(i * 91) % 255},${(i * 53) % 255})`;
      x.fillRect((i * 13) % 400, (i * 29) % 300, 9, 9);
    }
    return cv.toDataURL("image/png").split(",")[1];
  }),
  "base64"
);
await p.locator('input[type="file"][accept*="svg"]').setInputFiles({ name: "farm_cow-photo.png", mimeType: "image/png", buffer: png });
await p.waitForTimeout(1500);
check(db.media.length === 1 && db.media[0].name === "farm cow photo" && db.media[0].source === "upload" && db.media[0].width === 400 && db.media[0].height === 300, "an uploaded picture is catalogued: tidy name, size, source", JSON.stringify(db.media[0] && { name: db.media[0].name, source: db.media[0].source }));
check(Object.keys(db.storage).length === 1 && db.media[0].path === Object.keys(db.storage)[0].replace("book-images/", "") && db.media[0].path.startsWith("11111111-1111-4111-8111-111111111111/"), "its file is in the user's own storage folder");
check((await list().getByRole("listitem").count()) === 1, "it shows under My pictures straight away");
// The same file again: still one entry, one file.
await p.locator('input[type="file"][accept*="svg"]').setInputFiles({ name: "again.png", mimeType: "image/png", buffer: png });
await p.waitForTimeout(1200);
check(db.media.length === 1 && Object.keys(db.storage).length === 1, "uploading the same picture again adds nothing");
await p.keyboard.press("Escape");
await p.screenshot({ path: shot("media-library.png") });
noPageErrors(p);
await p.context().close();

// ---- another book, on another device
const q = await newPage(b);
await mockSupabase(q, { db });
cb = await open(q, B);
await q.keyboard.press("s");
const mine = q.getByRole("list", { name: "My pictures" });
await mine.getByRole("listitem").first().waitFor({ timeout: 8000 });
check((await mine.getByRole("listitem").count()) === 1, "the picture is offered in a different book, on a different device");
await mine.getByRole("button", { name: "Use farm cow photo" }).click();
await q.mouse.click(cb.x + 300, cb.y + 400);
await q.waitForTimeout(1200);
const placed = await images(q);
check(placed.length === 1 && placed[0].src.startsWith("http") && placed[0].w === 400, "clicking it and then the page places the picture, loaded from its link", JSON.stringify(placed));
const exportable = await q.evaluate(() => { try { return window.Konva.stages[0].toDataURL().length > 1000; } catch (e) { return String(e); } });
check(exportable === true, "the page can still be exported", String(exportable));
await q.waitForTimeout(4000); // autosave
const saved = db.books.find((bk) => bk.id === B).pages[0].objects[0];
check(saved?.src === db.media[0].url && Object.keys(db.storage).length === 1, "the book saves the link — no second copy of the file");

// ---- delete: asks first
q.removeAllListeners("dialog");
const asked = [];
let answer = false;
q.on("dialog", (d) => { asked.push(d.message()); void (answer ? d.accept() : d.dismiss()); });
await q.keyboard.press("s");
await mine.getByRole("listitem").first().hover();
await q.getByRole("button", { name: "Delete farm cow photo" }).click();
await q.waitForTimeout(400);
check(asked.length === 1 && asked[0].includes("will lose the picture") && db.media.length === 1, "deleting warns that pages using the picture lose it; cancelling keeps it");
answer = true;
await q.getByRole("button", { name: "Delete farm cow photo" }).click();
await q.waitForTimeout(800);
check(db.media.length === 0 && Object.keys(db.storage).length === 0 && (await q.getByRole("list", { name: "My pictures" }).count()) === 0, "confirming removes the entry and the file");
noPageErrors(q);
await q.context().close();

// ---- no library (migration not run): the section isn't shown and nothing breaks
const r = await newPage(b);
await mockSupabase(r, { db: { books: db.books, comments: [] } });
await open(r, A);
await r.keyboard.press("s");
await r.waitForTimeout(500);
check((await r.getByText("My pictures").count()) === 0 && await r.getByText("My stamps").first().isVisible(), "without the library set up the section is simply absent");
check(r.dialogs.length === 0, "no alerts");
noPageErrors(r);
await b.close();
