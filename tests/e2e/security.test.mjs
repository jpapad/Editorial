// Listing kit escapes user text (no HTML injection); an old "book-…" id in the URL
// is replaced with a fresh uuid instead of erroring.
import { BASE, launch, newPage, openEditor, check, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
await openEditor(p);
await p.getByRole('button', { name: 'Amazon listing kit' }).click();
await p.getByPlaceholder('e.g. dinosaurs, Ancient Greece').fill('<img src=x onerror=alert("xss")>dinosaurs');
await p.waitForTimeout(600);
check((await p.locator('[role=dialog] img').count()) === 0, 'listing kit: HTML in the theme is not rendered');
check(!p.dialogs.includes('xss'), 'listing kit: injected script did not run');

const u = await newPage(b);
const uuidErrors = [];
u.on('console', (m) => { if (/uuid/i.test(m.text())) uuidErrors.push(m.text()); });
await u.goto(`${BASE}/?book=book-1790623737004-jwqwbc`);
await u.waitForSelector('canvas', { timeout: 30000 }); await u.waitForTimeout(1500);
const id = new URL(u.url()).searchParams.get('book') ?? '';
check(/^[0-9a-f-]{36}$/.test(id), 'legacy book-… id replaced with a uuid', id);
check(uuidErrors.length === 0 && !u.dialogs.some((d) => /uuid/i.test(d)), 'no uuid errors');
noPageErrors(p, u);
await b.close();
