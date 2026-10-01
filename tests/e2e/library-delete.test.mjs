// Library cards: the delete (and colour / duplicate) actions are always visible,
// and delete asks first.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1440, height: 1000 } });
const page1 = { id: "p1", pageNumber: 1, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [] };
const db = await mockSupabase(p, { books: [
  bookRow({ id: "22222222-2222-4222-8222-222222222222", title: "Keep me", pages: [page1], updated_at: "2026-09-30T10:00:00Z" }),
  bookRow({ id: "33333333-3333-4333-8333-333333333333", title: "Delete me", pages: [page1], updated_at: "2026-09-29T10:00:00Z" }),
] });
const asked = [];
let answer = false;
p.removeAllListeners("dialog");
p.on("dialog", (d) => { asked.push(d.message()); void (answer ? d.accept() : d.dismiss()); });

await p.goto(`${BASE}/studio`);
await p.waitForTimeout(2000);
const del = p.getByRole("button", { name: "Delete Delete me" });
check(await del.isVisible(), "delete button is visible without hovering");
await p.screenshot({ path: shot("library-actions.png") });

await del.click();
await p.waitForTimeout(400);
check(asked.length === 1 && asked[0].includes("Delete me") && db.books.length === 2, "asks first; cancelling keeps the book", asked[0]);

answer = true;
await del.click();
await p.waitForTimeout(800);
check(db.books.length === 1 && db.books[0].title === "Keep me", "confirming deletes it");
check((await p.getByText("Delete me", { exact: true }).count()) === 0 && (await p.getByRole("button", { name: "Delete Keep me" }).isVisible()), "the card disappears; the other book stays");
noPageErrors(p);
await b.close();
