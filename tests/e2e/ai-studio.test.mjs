// Sketch-photo cleanup places line art; AI series fails cleanly when signed out;
// comments panel asks to sign in; the book preview turns pages.
import { launch, newPage, openEditor, check, inkNodes, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
await openEditor(p);

// Synthetic phone photo: shaded paper + grain + a pencil house drawing
const b64 = await p.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 900;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1200, 900); g.addColorStop(0, '#6d6a62'); g.addColorStop(0.55, '#d9d4c8'); g.addColorStop(1, '#f4f1ea');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1200, 900);
  const img = ctx.getImageData(0, 0, 1200, 900);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 18; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(40,40,45,0.55)'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  ctx.strokeRect(330, 400, 460, 330);
  ctx.beginPath(); ctx.moveTo(300, 410); ctx.lineTo(560, 200); ctx.lineTo(820, 410); ctx.stroke();
  ctx.strokeRect(500, 560, 110, 170);
  ctx.beginPath(); ctx.arc(150, 170, 80, 0, Math.PI * 2); ctx.stroke();
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
});

await p.getByRole('button', { name: 'AI and import' }).click(); await p.waitForTimeout(300);
await p.locator('input[type=file][accept="image/*"]').first().setInputFiles({ name: 'sketch.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
await p.waitForTimeout(2500);
const n0 = await inkNodes(p);
await p.getByRole('button', { name: 'Fill page' }).click(); await p.waitForTimeout(800);
check((await inkNodes(p)) === n0 + 1, 'cleaned-up sketch is placed on the page');
await p.screenshot({ path: shot('sketch-placed.png') });

await p.getByPlaceholder('Theme, e.g. Ancient Greece').fill('Ancient Greece');
await p.locator('textarea').first().fill('the Parthenon\nan owl');
await p.getByRole('button', { name: /Generate 2 pages/ }).click();
await p.waitForTimeout(6000);
const status = (await p.locator('text=/of 2 added/').textContent().catch(() => '')) ?? '';
check(/0 of 2 added/.test(status), 'AI series signed out: nothing added, no crash', status);

await p.getByRole('button', { name: /^Comments/ }).click(); await p.waitForTimeout(500);
check(await p.getByText('Sign in to read and write comments.').isVisible(), 'comments panel asks to sign in');

await p.getByRole('button', { name: 'Add page' }).click();
await p.getByRole('button', { name: /Color Test Page/ }).click();
await p.getByRole('button', { name: 'Add page' }).click();
await p.getByRole('button', { name: /This Book Belongs To/ }).click();
await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Preview' }).click(); await p.waitForTimeout(3000);
const label0 = await p.locator('h2').first().textContent();
await p.getByRole('button', { name: 'Next', exact: true }).click(); await p.waitForTimeout(400);
const label1 = await p.locator('h2').first().textContent();
check(label0 !== label1, 'book preview turns to the next spread', `${label0} -> ${label1}`);
await p.screenshot({ path: shot('spread-preview.png') });

noPageErrors(p);
await b.close();
