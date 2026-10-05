// Phone-sized coloring, color names read aloud, sound switch, coloring kept on the
// tablet while offline, and the installable-app files.
import { BASE, launch, newPage, check, shot, paintedPixels, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const circle = { kind: "shape", id: "c1", shapeKind: "circle", x: 150, y: 250, width: 300, height: 300, rotation: 0, scaleX: 1, scaleY: 1, fill: "#ffffff", stroke: "#111827", strokeWidth: 6 };
const book = bookRow({ title: "Ocean", pages: [{ id: "p1", pageNumber: 1, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [circle] }] });

// A class with one child and one book, set up straight in the mock.
const phoneCtx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const k = await newPage(phoneCtx, { lang: "en" });
const db = await mockSupabase(k, { signedIn: false, books: [book] });
db.kids = { books: db.books, groups: [{ id: "g1", kind: "family", name: "Home", code: "HOME42", created_at: "2026-10-01T00:00:00Z" }], members: [{ id: "m1", group_id: "g1", name: "Leo", avatar: 4, pin: [0, 5], token: "tok-leo", created_at: "2026-10-01T00:00:00Z" }], groupBooks: [{ group_id: "g1", book_id: book.id }], work: [] };
await k.addInitScript(() => {
  window.__spoken = [];
  window.speechSynthesis.speak = (u) => window.__spoken.push(u.text);
  localStorage.setItem("pagewright-kid:HOME42", JSON.stringify({ memberId: "m1", token: "tok-leo" }));
});

await k.goto(`${BASE}/kids/HOME42`);
await k.waitForTimeout(1500);
check((await k.getByRole("heading", { name: /Hi Leo!/ }).count()) === 1, "a remembered child goes straight to their home");
await k.getByRole("button", { name: "Read it to me" }).click();
check((await k.evaluate(() => window.__spoken.at(-1))) === "Hi Leo! Pick a book to color.", "'Read it to me' reads the greeting aloud");
await k.getByRole("button", { name: /Color “Ocean”/ }).click();
await k.waitForSelector("canvas", { timeout: 30000 });
await k.waitForTimeout(1500);

const fits = await k.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
check(fits, "on a phone the board fits the screen — no sideways scrolling");
check(await k.getByRole("button", { name: "I'm done!" }).isVisible(), "the toolbar (wrapped onto two rows) is all on screen");
await k.screenshot({ path: shot("kids-phone.png") });

await k.getByRole("button", { name: "#2f80ed" }).click().catch(async () => k.locator('[aria-label*="2f80ed" i]').first().click());
check((await k.evaluate(() => window.__spoken.at(-1))) === "Blue", "picking a color says its name");

// Offline: the save fails → kept on the tablet, banner shown; back online → sent.
let offline = true;
await k.route("**/rest/v1/rpc/kid_save", (route) => (offline ? route.abort("internetdisconnected") : route.fallback()));
const cb = await k.locator("canvas").first().boundingBox();
const c = await k.evaluate(() => { const r = window.Konva.stages[0].findOne("Ellipse").getClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await k.mouse.click(cb.x + c[0], cb.y + c[1]);
await k.waitForTimeout(1500);
check((await paintedPixels(k)) > 3000, "a tap on a phone fills the shape under the finger (pointer maths right on a resized board)");
check(await k.getByText(/No internet — your coloring is kept on this tablet/).isVisible(), "offline: the child is told the coloring is kept on the tablet");
check(db.kids.work.length === 0, "nothing reached the server yet");
offline = false;
await k.evaluate(() => window.dispatchEvent(new Event("online")));
await k.waitForTimeout(1500);
check(db.kids.work.length === 1 && db.kids.work[0].fill?.startsWith("data:image/png"), "back online: the kept page is sent");
check((await k.getByText(/No internet/).count()) === 0, "and the banner goes away");

// Sound switch.
await k.getByRole("button", { name: "Sound on" }).click();
await k.getByRole("button", { name: "#e5484d" }).click().catch(() => undefined);
check((await k.evaluate(() => window.__spoken.at(-1))) !== "Red" && (await k.evaluate(() => localStorage.getItem("pagewright-kid-sound"))) === "off", "with sound off, colors aren't read aloud (and the choice is remembered)");

// Installable app.
const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
check(manifest.display === "standalone" && manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable") && manifest.shortcuts.some((s) => s.url === "/kids"), "the web app manifest: standalone, maskable icon, a Kids shortcut");
const sw = await fetch(`${BASE}/sw.js`);
check(sw.ok && /no-store/.test(sw.headers.get("cache-control") ?? ""), "the service worker is served uncached");
check((await fetch(`${BASE}/offline.html`)).ok && (await fetch(`${BASE}/icon-192.png`)).ok, "offline page and icons are there");
noPageErrors(k);
await b.close();
