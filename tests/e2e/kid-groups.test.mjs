// Classes & families: a teacher makes a class, adds children and a book; a child signs in
// with the code and two pictures, colors a page (saved with the class, not the device),
// and the teacher sees it and gives a sticker.
import { BASE, launch, newPage, check, shot, paintedPixels, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const circle = { kind: "shape", id: "c1", shapeKind: "circle", x: 150, y: 250, width: 300, height: 300, rotation: 0, scaleX: 1, scaleY: 1, fill: "#ffffff", stroke: "#111827", strokeWidth: 6 };
const page = (id, n) => ({ id, pageNumber: n, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [{ ...circle, id: `c${n}` }] });
const book = bookRow({ title: "Farm animals", pages: [page("p1", 1), page("p2", 2), { ...page("pb", 3), objects: [], isBlankBack: true }] });

// ---- teacher
const teacherCtx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const t = await newPage(teacherCtx, { acceptDialogs: true });
const db = await mockSupabase(t, { books: [book] });
db.kids = { books: db.books };
await t.goto(`${BASE}/studio`);
await t.waitForTimeout(2000);
await t.getByRole("link", { name: "Classes & families" }).click();
await t.waitForURL(/\/studio\/groups/);
await t.waitForTimeout(1200);
await t.getByLabel("Group name").fill("Class 2B");
await t.getByRole("button", { name: "Create" }).click();
await t.waitForTimeout(800);
const code = (await t.getByTestId("group-code").textContent()).trim();
check(/^[A-Z2-9]{6}$/.test(code), "the class gets a 6-character code", code);
await t.getByLabel("Children's names").fill("Μαρία, Νίκος");
await t.getByRole("button", { name: "Add" }).click();
await t.waitForTimeout(600);
check(db.kids.members.length === 2 && (await t.getByText("Μαρία", { exact: true }).count()) === 1, "two children added from one line of names");
check((await t.getByLabel(/Μαρία's pictures:/).count()) === 1, "each child's two pictures are shown to the teacher");
await t.getByRole("checkbox").first().check();
await t.waitForTimeout(500);
check(db.kids.groupBooks.length === 1 && db.kids.groupBooks[0].book_id === book.id, "the book is given to the class");
await t.screenshot({ path: shot("groups-teacher.png"), fullPage: true });

// ---- child (another tablet, signed out, Greek UI)
const kidCtx = await b.newContext({ viewport: { width: 1200, height: 900 } });
const k = await newPage(kidCtx, { lang: null });
await mockSupabase(k, { signedIn: false, db });
await k.goto(`${BASE}/kids`);
await k.getByLabel("Κωδικός τάξης").fill(code.toLowerCase());
await k.getByRole("button", { name: "Πάμε!" }).click();
await k.waitForURL(new RegExp(`/kids/${code}`));
await k.waitForTimeout(1200);
check((await k.getByRole("heading", { name: "Ποιος είσαι;" }).count()) === 1, "the code leads to 'Who are you?'");
await k.getByRole("button", { name: /Μαρία/ }).click();
const maria = db.kids.members.find((m) => m.name === "Μαρία");
const names = ["Γάτα", "Σκύλος", "Ψάρι", "Πουλί", "Μήλο", "Ήλιος", "Αστέρι", "Καρδιά", "Αυτοκίνητο"];
const wrong = (maria.pin[0] + 1) % 9;
await k.getByRole("button", { name: names[wrong], exact: true }).click();
await k.getByRole("button", { name: names[maria.pin[1]], exact: true }).click();
await k.waitForTimeout(600);
check((await k.getByText("Όχι αυτές — δοκίμασε ξανά!").count()) === 1, "wrong pictures: 'try again'");
await k.getByRole("button", { name: names[maria.pin[0]], exact: true }).click();
await k.getByRole("button", { name: names[maria.pin[1]], exact: true }).click();
await k.waitForTimeout(1200);
check((await k.getByRole("heading", { name: "Γεια σου Μαρία!" }).count()) === 1, "right pictures: the child's home");
check((await k.getByText("0 από 2 σελίδες").count()) === 1, "the class book shows 0 of 2 pages (blank back left out)");
await k.getByRole("button", { name: /Ζωγράφισε το «Farm animals»/ }).click();
await k.waitForSelector("canvas", { timeout: 30000 });
await k.waitForTimeout(1500);
const cb = await k.locator("canvas").first().boundingBox();
const c = await k.evaluate(() => { const r = window.Konva.stages[0].findOne("Ellipse").getClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await k.mouse.click(cb.x + c[0], cb.y + c[1]);
await k.waitForTimeout(1200);
check((await paintedPixels(k)) > 10000, "the child fills the circle");
await k.getByRole("button", { name: "Τελείωσα!" }).click();
await k.waitForTimeout(1500);
const saved = db.kids.work.find((w) => w.member_id === maria.id && w.page_id === "p1");
check(Boolean(saved?.completed_at && saved.fill?.startsWith("data:image/png") && saved.thumb), "the finished page is saved with the class: paint, thumbnail, done", JSON.stringify({ done: saved?.completed_at, fill: saved?.fill?.slice(0, 22) }));
check(db.books[0].pages[0].fillDataUrl === undefined, "the teacher's own book isn't touched");
await k.keyboard.press("Escape");
await k.goto(`${BASE}/kids/${code}`);
await k.waitForTimeout(1500);
check((await k.getByText("1 από 2 σελίδες").count()) === 1, "back home (and after a reload): still signed in, 1 of 2 done");

// A second tablet: the work is there too.
const k2 = await newPage(await b.newContext({ viewport: { width: 1200, height: 900 } }), { lang: null });
await mockSupabase(k2, { signedIn: false, db });
await k2.goto(`${BASE}/kids/${code}`);
await k2.getByRole("button", { name: /Μαρία/ }).click();
await k2.getByRole("button", { name: names[maria.pin[0]], exact: true }).click();
await k2.getByRole("button", { name: names[maria.pin[1]], exact: true }).click();
await k2.waitForTimeout(1200);
await k2.getByRole("button", { name: /Ζωγράφισε το/ }).click();
await k2.waitForSelector("canvas", { timeout: 30000 });
await k2.waitForTimeout(2000);
check((await paintedPixels(k2)) > 10000, "on another tablet the page opens already colored");

// ---- teacher sees it and rewards it
await t.reload();
await t.waitForTimeout(2000);
await t.getByRole("button", { name: /Μαρία's page from “Farm animals”/ }).click();
await t.getByRole("radio", { name: "Rainbow" }).click();
await t.getByPlaceholder("e.g. Beautiful colors!").fill("Υπέροχα χρώματα!");
await t.getByRole("button", { name: "Save" }).click();
await t.waitForTimeout(600);
check(saved.sticker === 2 && saved.comment === "Υπέροχα χρώματα!", "the teacher gives a sticker and a note", JSON.stringify({ s: saved.sticker, c: saved.comment }));
await k.reload();
await k.waitForTimeout(1500);
check((await k.getByText("Υπέροχα χρώματα!").count()) === 1, "the child sees the teacher's note on their home");
await k.screenshot({ path: shot("groups-kid-home.png"), fullPage: true });

// Teacher gives new pictures → the tablet is signed out.
await t.getByRole("button", { name: "New pictures for Μαρία" }).click();
await t.waitForTimeout(600);
await k.reload();
await k.waitForTimeout(1500);
check((await k.getByRole("heading", { name: "Ποιος είσαι;" }).count()) === 1, "after 'New pictures' the old tablet has to sign in again");
noPageErrors(t, k, k2);
await b.close();
