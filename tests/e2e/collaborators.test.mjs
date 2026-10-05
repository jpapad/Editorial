// Working together: invite links, an editor saving someone else's book (without taking it over),
// a save conflict with another person's newer save, viewers, and "Shared with me".
import { BASE, launch, newPage, check, shot, draw, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow, TEST_USER } from "./mockSupabase.mjs";

const b = await launch();
const OTHER = "99999999-9999-4999-8999-999999999999";
const page = { id: "p1", pageNumber: 1, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [] };

// ---- owner: make an invite link
const owner = await newPage(b, { viewport: { width: 1440, height: 1000 } });
const db = await mockSupabase(owner, { books: [bookRow({ title: "Team book", pages: [page] })] });
db.team = { members: [{ book_id: bookRow().id, user_id: OTHER, role: "editor", email: "illustrator@x.gr", added_at: "2026-10-01T00:00:00Z" }], invites: [], role: "owner", shared: [] };
const writes = [];
await owner.goto(`${BASE}/studio/editor?book=${bookRow().id}`);
await owner.waitForSelector("canvas", { timeout: 30000 });
await owner.waitForTimeout(1500);
await owner.getByRole("button", { name: "Work together" }).click();
const team = owner.getByRole("dialog", { name: "Work together" });
check(await team.getByText("illustrator@x.gr").isVisible(), "the owner sees who's on the book");
await team.getByRole("button", { name: "Link to edit" }).click();
await owner.waitForTimeout(500);
const url = (await team.getByTestId("invite-url").first().textContent()).trim();
check(/\/studio\/join\/[0-9a-f-]{36}$/.test(url) && db.team.invites[0]?.role === "editor", "an edit link is made", url);
await team.getByRole("combobox", { name: /Role of illustrator@x.gr/ }).selectOption("viewer");
await owner.waitForTimeout(300);
check(db.team.members[0].role === "viewer", "the owner changes a person's role");
await owner.screenshot({ path: shot("team-dialog.png") });
await owner.keyboard.press("Escape");

// ---- invitee, signed out: the link survives signing in
const inviteeCtx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const inv = await newPage(inviteeCtx);
await mockSupabase(inv, { signedIn: false, db, onWrite: (k, v) => writes.push([k, v]) });
await inv.goto(url.replace(/^https?:\/\/[^/]+/, BASE));
await inv.waitForURL(/\/login/, { timeout: 15000 });
check(await inv.evaluate(() => sessionStorage.getItem("pagewright-return-to")) === new URL(url).pathname, "signed out: the invite is remembered while signing in");
await mockSupabase(inv, { db, onWrite: (k, v) => writes.push([k, v]) }); // now signed in
db.books[0].user_id = OTHER; // the book belongs to someone else from here on
db.team.role = "editor";
await inv.goto(`${BASE}/studio`);
await inv.waitForURL(/\/studio\/editor\?book=/, { timeout: 20000 });
check(writes.some(([k]) => k === "accept_invite"), "after signing in the invite is accepted and the book opens");
await inv.waitForSelector("canvas", { timeout: 30000 });
await inv.waitForTimeout(1500);
check((await inv.getByText(/Reviewing someone else's book/).count()) === 0, "an editor isn't in read-only review mode");

// The editor draws: the save updates the book in place — never its owner.
const cb = await inv.locator("canvas").first().boundingBox();
await inv.keyboard.press("p");
await draw(inv, cb, [[150, 200], [300, 300]]);
await inv.waitForTimeout(1500);
const saves = writes.filter(([k]) => k === "books");
check(saves.length > 0 && saves.every(([, row]) => !("user_id" in row)), "the editor's saves never send an owner", JSON.stringify(saves.map(([, r]) => Object.keys(r))));
check(db.books[0].user_id === OTHER && db.books[0].pages[0].lines.length === 1, "the book keeps its owner and gets the editor's stroke");

// Someone else saves meanwhile → this tab's next save is refused and the user decides.
db.books[0].updated_at = "2030-01-01T00:00:00.000Z";
db.books[0].title = "Renamed by the owner";
await draw(inv, cb, [[200, 400], [350, 450]]);
await inv.waitForTimeout(1500);
check(await inv.getByRole("alert").filter({ hasText: "Someone else saved changes" }).isVisible(), "a newer save by someone else is noticed instead of being overwritten");
check(db.books[0].title === "Renamed by the owner" && db.books[0].pages[0].lines.length === 1, "their save is still intact");
await inv.screenshot({ path: shot("save-conflict.png") });
await inv.getByRole("button", { name: "Keep mine" }).click();
await inv.waitForTimeout(1200);
check(db.books[0].pages[0].lines.length === 2 && (await inv.getByText(/Someone else saved changes/).count()) === 0, "'Keep mine' saves this version on purpose");

// ---- a viewer reads and comments but doesn't save
noPageErrors(inv);
await inv.close(); // its autosaves would land in the same mock
db.team.role = "viewer";
const viewer = await newPage(inviteeCtx);
await mockSupabase(viewer, { db, onWrite: (k, v) => writes.push([k, v]) });
writes.length = 0;
await viewer.goto(`${BASE}/studio/editor?book=${bookRow().id}`);
await viewer.waitForSelector("canvas", { timeout: 30000 });
await viewer.waitForTimeout(2500);
const banner = await viewer.getByText(/Reviewing someone else's book/).count();
const viewerSaves = writes.filter(([k]) => k === "books").length;
check(banner === 1 && viewerSaves === 0, "a viewer gets the review banner and nothing is saved", JSON.stringify({ banner, viewerSaves }));

// ---- Shared with me
db.team.shared = [{ book: { ...bookRow({ title: "Their book", user_id: OTHER }) }, role: "editor" }];
db.books = [];
await viewer.goto(`${BASE}/studio`);
await viewer.waitForTimeout(2000);
await viewer.getByRole("button", { name: /Shared with me/ }).click();
check(await viewer.getByText("Their book").isVisible() && await viewer.getByText("Can edit").first().isVisible(), "'Shared with me' lists books others invited me to, with my role");
noPageErrors(owner, viewer);
await b.close();
