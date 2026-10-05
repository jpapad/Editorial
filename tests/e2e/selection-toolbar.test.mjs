// The floating bar above a selection: duplicate, mirror, group, lock, delete.
import { launch, newPage, openEditor, check, inkNodes, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const bar = p.getByRole("toolbar", { name: "Selection actions" });
const groups = () => p.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").getChildren().filter((n) => n.getClassName() === "Group").map((g) => ({ x: Math.round(g.x()), scaleX: g.scaleX() })));

check((await bar.count()) === 0, "no bar without a selection");
await p.keyboard.press("r");
await p.getByRole("button", { name: "Star", exact: true }).click();
await p.mouse.click(cb.x + 250, cb.y + 320);
await p.waitForTimeout(300);
check(await bar.isVisible(), "bar appears for the new selection");
const box = await bar.boundingBox();
check(box.y + box.height < cb.y + 320, "bar sits above the object");
await p.screenshot({ path: shot("selection-toolbar.png") });

const n0 = await inkNodes(p);
await bar.getByRole("button", { name: "Duplicate selection" }).click();
await p.waitForTimeout(200);
check((await inkNodes(p)) === n0 + 1, "duplicate adds a copy");

await bar.getByRole("button", { name: "Mirror selection" }).click();
await p.waitForTimeout(200);
check((await groups()).at(-1).scaleX === -1, "mirror flips the selection");

await bar.getByRole("button", { name: "Delete selection" }).click();
await p.waitForTimeout(200);
check((await inkNodes(p)) === n0 && (await bar.count()) === 0, "delete removes it and the bar goes away");

// Select the star again and lock it: the bar goes, and clicking it no longer selects.
await p.keyboard.press("v");
await p.mouse.click(cb.x + 250, cb.y + 320);
await p.waitForTimeout(200);
await bar.getByRole("button", { name: "Lock selection" }).click();
await p.waitForTimeout(200);
await p.mouse.click(cb.x + 250, cb.y + 320);
await p.waitForTimeout(200);
check((await bar.count()) === 0, "locked object can't be selected again");

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
