// The app defaults to Greek, the language toggle switches, and no English is left
// visible in the Greek editor.
import { BASE, launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b, { lang: null });
await openEditor(p);
check(await p.getByRole('button', { name: 'Προσθήκη σελίδας' }).isVisible(), 'editor opens in Greek');
await p.getByRole('button', { name: 'Προσθήκη σελίδας' }).click(); await p.getByRole('button', { name: /Φύλλα εργασίας/ }).click(); await p.waitForTimeout(300);
await p.getByRole('radio', { name: 'Λαβύρινθος' }).click(); await p.getByRole('button', { name: /Προσθήκη 3 σελίδων/ }).click(); await p.waitForTimeout(800);
await p.locator('canvas').first().screenshot({ path: shot('maze-greek.png') });

const leftovers = await p.evaluate(() => {
  const words = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { if (walker.currentNode.parentElement?.closest('script,style,noscript')) continue; const s = walker.currentNode.textContent.trim(); if (/[A-Za-z]{3,}/.test(s) && !/[Α-Ωα-ω]/.test(s)) words.add(s); }
  document.querySelectorAll('[aria-label],[title],[placeholder]').forEach(el => ['aria-label', 'title', 'placeholder'].forEach(a => { const v = el.getAttribute(a); if (v && /[A-Za-z]{3,}/.test(v) && !/[Α-Ωα-ω]/.test(v)) words.add(`@${a}: ${v}`); }));
  return [...words];
});
// Brand, units and font names are meant to stay as they are.
const allowed = /^(Pagewright|PDF|KDP|AI|PNG|JPG|SVG|Letter|A4|pt|in|mm|px|Archivo|JetBrains Mono|@[\w-]+: (Pagewright|PDF|#[0-9a-f]{6}))$/i;
const english = leftovers.filter((w) => !allowed.test(w));
check(english.length === 0, 'no untranslated English in the Greek editor', JSON.stringify(english).slice(0, 400));

await p.getByRole('radio', { name: 'en' }).click(); await p.waitForTimeout(300);
check((await p.getByRole('button', { name: 'Add page' }).count()) === 1, 'toggle switches to English');
await p.getByRole('radio', { name: 'el' }).click(); await p.waitForTimeout(300);
check((await p.getByRole('button', { name: 'Προσθήκη σελίδας' }).count()) === 1, 'and back to Greek');

const l = await newPage(b, { lang: null });
await l.goto(`${BASE}/login`); await l.waitForTimeout(1500);
check(/[Α-Ωα-ω]/.test(await l.locator('body').innerText()), 'login page in Greek');
noPageErrors(p, l);
await b.close();
