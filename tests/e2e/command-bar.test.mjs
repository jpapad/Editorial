// The editor's AI command bar. The AI endpoints are mocked (the real ones need
// OPENAI_API_KEY); the mock also sends a bogus action and a made-up id to prove
// the editor only runs the validated, known set.
import { BASE, launch, newPage, openEditor, check, inkNodes, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
let mode = "ok";
const sent = [];
await p.route(`${BASE}/api/editor-command`, async (route) => {
  const req = JSON.parse(route.request().postData());
  sent.push(req);
  if (mode === "signed-out") return route.fulfill({ status: 401, json: { error: "Sign in to use AI features." } });
  const star = req.page.objects.find((o) => o.what === "star");
  await route.fulfill({
    json: {
      reply: "Added a crab and made the star bigger.",
      actions: [
        { type: "add_picture", subject: "a little crab", x: 0.2, y: 0.8, w: 0.3 },
        { type: "scale", ids: [star.id], factor: 2 },
        { type: "run_shell", command: "rm -rf /" },
        { type: "delete", ids: ["made-up-id"] },
      ],
    },
  });
});
const pictures = [];
await p.route(`${BASE}/api/generate-line-art`, async (route) => {
  pictures.push(JSON.parse(route.request().postData()).subject);
  await route.fulfill({ json: { results: [{ ok: true, svgMarkup: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><ellipse cx="200" cy="150" rx="150" ry="90" fill="none" stroke="#000" stroke-width="10"/></svg>' }] } });
});

const cb = await openEditor(p);
await p.keyboard.press("r");
await p.getByRole("button", { name: "Star", exact: true }).click();
await p.mouse.click(cb.x + 250, cb.y + 300);
await p.waitForTimeout(300);
const starWidth = () => p.evaluate(() => { const g = window.Konva.stages[0].findOne(".ink-layer").getChildren().filter((n) => n.getClassName() === "Group")[0]; return Math.round(g.getClientRect().width); });
const w0 = await starWidth();
const n0 = await inkNodes(p);

const input = p.getByRole("textbox", { name: "AI command" });
await p.keyboard.press("Escape");
await p.mouse.click(cb.x + 40, cb.y + 40);
await p.keyboard.press("Control+k");
check(await input.evaluate((el) => el === document.activeElement), "Ctrl/⌘K focuses the command bar");
await input.fill("add a little crab bottom left and make the star bigger");
await input.press("Enter");
const status = p.getByRole("status").filter({ hasText: "Added a crab" });
await status.waitFor({ timeout: 10000 });
check(sent[0].command.includes("crab") && sent[0].page.objects.some((o) => o.what === "star") && sent[0].lang === "en", "sends the command with a summary of the page (no images)", JSON.stringify(sent[0].page.objects.map((o) => o.what)));
check(!JSON.stringify(sent[0]).includes("data:image"), "no image data in the request");
check(pictures.join() === "a little crab", "draws the one picture it asked for");
check((await inkNodes(p)) === n0 + 1, "the crab is on the page; the bogus actions did nothing");
check((await starWidth()) > w0 * 1.6, "the star got bigger", `${w0} → ${await starWidth()}`);
await p.screenshot({ path: shot("command-bar.png") });

await status.getByRole("button", { name: "Undo" }).click();
await p.waitForTimeout(300);
check((await inkNodes(p)) === n0 && Math.abs((await starWidth()) - w0) <= 2, "one Undo reverts the whole command");

mode = "signed-out";
await input.fill("make it blue");
await input.press("Enter");
await p.getByRole("status").filter({ hasText: "Sign in to use AI features." }).waitFor({ timeout: 10000 });
check((await input.inputValue()) === "make it blue", "a failed command keeps the text so it can be retried");
check((await inkNodes(p)) === n0, "a failed command changes nothing");
noPageErrors(p);
await b.close();
