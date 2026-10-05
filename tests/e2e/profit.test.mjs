// Price & royalty: KDP printing cost and royalty for the book on screen.
import { launch, newPage, openEditor, check, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
await openEditor(p);
const side = (name) => p.getByRole("button", { name, exact: true });

await side("Price & royalty").scrollIntoViewIfNeeded();
await side("Price & royalty").click();
const dialog = p.getByRole("dialog");
check(await dialog.getByText(/KDP prints black ink books from 24 to 828 pages; this one has 2/).isVisible(), "a 1-page book is too short to print, and the dialog says why");

await dialog.getByRole("button", { name: "Done" }).click();
// 24 pages: the shortest book KDP prints.
for (let i = 0; i < 23; i++) {
  await p.getByRole("button", { name: "Add page" }).click();
  await p.getByRole("button", { name: /Full Drawing Page/ }).click();
}
await side("Price & royalty").click();
check((await dialog.getByText("$2.84").count()) > 0, "24 pages, 8.5 × 11 in, black ink: $2.84 to print");
check((await dialog.getByLabel("List price").inputValue()) === "9.99", "starts at the first price that earns 60%");
check((await dialog.getByTestId("royalty-amazon").textContent()) === "$3.15", "earns $3.15 a copy at $9.99", await dialog.getByTestId("royalty-amazon").textContent());
check((await dialog.getByTestId("royalty-month").textContent()) === "$94.50", "30 copies a month → $94.50");
await dialog.getByLabel("List price").fill("4");
check(await dialog.getByText(/won't accept a price under \$5.68/).isVisible(), "too low a price is flagged with KDP's floor");
await dialog.getByRole("radio", { name: "Amazon.co.uk (GBP)" }).click();
check((await dialog.getByLabel("List price").inputValue()) === "7.99" && (await dialog.getByText("£2.15").count()) > 0, "UK: £2.15 to print, price moves to £7.99");
noPageErrors(p);
await b.close();
