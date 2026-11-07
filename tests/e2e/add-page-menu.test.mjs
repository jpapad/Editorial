// The "add page" menu fits in the window — on a short laptop screen too — and scrolls to its last item.
import { launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
for (const [w, h] of [[1470, 780], [1280, 640]]) {
  const p = await newPage(b, { viewport: { width: w, height: h }, lang: null });
  await openEditor(p);
  await p.getByRole("button", { name: "Προσθήκη σελίδας" }).click();
  const menu = p.getByText("Πρότυπα διάταξης").locator("..");
  const box = await menu.boundingBox();
  check(box && box.y >= 0 && box.y + box.height <= h, `${w}×${h}: the whole menu is inside the window`, JSON.stringify(box));
  check(await p.getByText("Πρότυπα διάταξης").isVisible(), `${w}×${h}: its heading isn't cut off`);
  const last = p.getByRole("button", { name: /Φύλλα εργασίας/ });
  await last.scrollIntoViewIfNeeded();
  check(await last.isVisible(), `${w}×${h}: the last item can be reached`);
  await p.screenshot({ path: shot(`add-page-menu-${h}.png`) });
  noPageErrors(p);
}
await b.close();
