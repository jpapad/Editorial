// Ready-made cover layouts, the "what you get" listing picture, and starting the next volume.
import { BASE, launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();

// ---- cover layouts + listing picture (local editor)
{
  const p = await newPage(b);
  const cb = await openEditor(p);
  const png = Buffer.from(
    await p.evaluate(() => {
      const cv = document.createElement("canvas");
      cv.width = 240;
      cv.height = 300;
      const x = cv.getContext("2d");
      x.fillStyle = "#fff";
      x.fillRect(0, 0, 240, 300);
      x.strokeStyle = "#000";
      x.lineWidth = 10;
      x.beginPath();
      x.arc(120, 150, 80, 0, Math.PI * 2);
      x.stroke();
      return cv.toDataURL("image/png").split(",")[1];
    }),
    "base64"
  );
  await p.keyboard.press("s");
  await p.locator('input[type="file"][accept*="svg"]').setInputFiles({ name: "ring.png", mimeType: "image/png", buffer: png });
  await p.waitForTimeout(400);
  await p.mouse.click(cb.x + 280, cb.y + 380);
  await p.waitForTimeout(400);

  await p.getByRole("tab", { name: "Cover" }).click();
  await p.waitForTimeout(900);
  const cover = () =>
    p.evaluate(() => {
      const layer = window.Konva.stages[0].findOne(".ink-layer");
      return {
        texts: layer.find("Text").map((t) => ({ text: t.text(), fill: t.fill(), x: t.x() })),
        images: layer.find("Image").filter((n) => n.name() !== "paint" && n.width() > 20).length,
        darkRects: layer.find("Rect").filter((r) => r.fill() === "#111827" && r.width() > 100).length,
        width: window.Konva.stages[0].width() / window.Konva.stages[0].scaleX(),
      };
    });
  const group = p.getByRole("group", { name: "Ready-made layouts" });
  await group.scrollIntoViewIfNeeded();
  await p.getByLabel("Subtitle (optional)").fill("For ages 3–5");
  await group.getByRole("button", { name: "Classic" }).click();
  await p.waitForTimeout(500);
  let c = await cover();
  const title = "My Coloring Book";
  check(c.texts.filter((t) => t.text === title).length === 2 && c.texts.some((t) => t.text === "For ages 3–5") && c.images === 1, "Classic: title on front and back, subtitle, and the book's picture", JSON.stringify(c.texts.map((t) => t.text)));
  check(c.texts.filter((t) => t.text === title).some((t) => t.x > c.width / 2) && c.texts.filter((t) => t.text === title).some((t) => t.x < c.width / 2), "the title sits on the front panel (right) and the back panel (left)");
  await p.screenshot({ path: shot("cover-classic.png") });
  await group.getByRole("button", { name: "Title band" }).click();
  await p.waitForTimeout(500);
  c = await cover();
  check(c.darkRects === 1 && c.texts.some((t) => t.text === title && t.fill === "#ffffff") && c.texts.filter((t) => t.text === title).length === 2 && c.images === 1, "Title band replaces it: white title on a dark band, nothing doubled");
  await p.screenshot({ path: shot("cover-band.png") });
  await p.keyboard.press("ControlOrMeta+z");
  await p.waitForTimeout(400);
  check((await cover()).darkRects === 0, "a layout change is one undo step");

  await p.getByRole("tab", { name: "Draw" }).click();
  await p.waitForTimeout(600);
  const mock = p.getByRole("button", { name: "Listing mockups" });
  await mock.scrollIntoViewIfNeeded();
  await mock.click();
  const dialog = p.getByRole("dialog");
  await dialog.getByRole("button", { name: "Download PNG" }).and(p.locator(":not([disabled])")).waitFor({ timeout: 20000 });
  await dialog.getByRole("radio", { name: "What you get" }).click();
  await p.waitForTimeout(400);
  const sum = () =>
    p.evaluate(() => {
      const cv = document.querySelector('canvas[aria-label="Mockup preview"]');
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let s = 0;
      let red = 0;
      for (let i = 0; i < d.length; i += 16) {
        s = (s + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000003;
        if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] < 90) red++;
      }
      return { s, red };
    });
  const before = await sum();
  check((await dialog.getByLabel("Selling point 1").inputValue()) === "1 page to color" && before.red > 500, "the 'what you get' picture lists the book's facts on colored pills", JSON.stringify(before));
  await dialog.getByLabel("Selling point 1").fill("40 fun pages");
  await p.waitForTimeout(300);
  check((await sum()).s !== before.s, "editing a selling point redraws the picture");
  await p.screenshot({ path: shot("mockup-features.png") });
  check(p.dialogs.length === 0, "no alerts");
  noPageErrors(p);
  await p.close();
}

// ---- next volume (library, signed in)
{
  const p = await newPage(b, { viewport: { width: 1440, height: 1000 } });
  const space = { width: 612, height: 792, bleed: 0 };
  const stamp = { kind: "stamp", id: "s1", src: "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), x: 80, y: 80, width: 300, height: 300, rotation: 0, scaleX: 1, scaleY: 1 };
  const note = { kind: "text", id: "t1", text: "This book belongs to", x: 80, y: 80, width: 300, height: 40, rotation: 0, scaleX: 1, scaleY: 1, fontFamily: "Arial", fontSize: 20, align: "center", fill: "#111827", isDragging: false };
  const db = await mockSupabase(p, {
    books: [bookRow({ id: "22222222-2222-4222-8222-222222222222", title: "Farm Animals", trim_size: "8.5x11", pages: [{ id: "p1", pageNumber: 1, space, lines: [], objects: [note] }, { id: "p2", pageNumber: 2, space, lines: [], objects: [stamp] }], updated_at: "2026-09-30T10:00:00Z" })],
  });
  await p.goto(`${BASE}/studio`);
  await p.waitForTimeout(2000);
  await p.getByRole("button", { name: "Start the next volume of Farm Animals" }).click();
  await p.waitForTimeout(1500);
  const made = db.books.find((bk) => bk.title === "Farm Animals 2");
  check(Boolean(made) && db.books.length === 2, "a 'Farm Animals 2' book is created");
  check(made?.pages.length === 2 && made.pages[0].objects.length === 1 && made.pages[0].objects[0].text === "This book belongs to" && made.pages[1].objects.length === 0, "front matter is kept, the picture page is emptied");
  check(made?.trim_size === "8.5x11" && made?.collection === "Farm Animals" && db.books.find((bk) => bk.title === "Farm Animals")?.collection === "Farm Animals", "same trim size; both volumes share a collection");
  check(await p.getByText("Farm Animals 2").first().isVisible(), "the new volume shows in the library");
  await p.screenshot({ path: shot("next-volume.png") });
  check(p.dialogs.length === 0, "no alerts");
  noPageErrors(p);
}
await b.close();
