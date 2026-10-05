import { billedPages, formatMoney, isLargeTrim, minimumExpandedPrice, minimumListPrice, priceIdeas, printingCost, royalty, royaltyRate } from "../../src/utils/kdpPricing";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 0.0051;

ok(isLargeTrim(612, 792) && isLargeTrim(576, 720) && !isLargeTrim(432, 648), "8.5×11 and 8×10 are large trim, 6×9 is regular");
ok(billedPages(41) === 42 && billedPages(40) === 40, "odd page counts are billed one page up");

// Hand-worked from KDP's tables.
ok(near(printingCost("us", "black", true, 50), 2.84), "US black, large, 50 pages: flat $2.84");
ok(near(printingCost("us", "black", false, 50), 2.3), "US black, regular, 50 pages: flat $2.30");
ok(near(printingCost("us", "black", true, 120), 1 + 0.017 * 120), "US black, large, 120 pages: $1 + $0.017 a page");
ok(near(printingCost("uk", "black", true, 120), 0.85 + 0.012 * 120), "UK black, large, 120 pages");
ok(near(printingCost("eu", "black", false, 200), 0.75 + 0.012 * 200), "EU black, regular, 200 pages");
ok(near(printingCost("us", "premium-color", true, 32), 4.2) && near(printingCost("us", "premium-color", true, 60), 1 + 0.08 * 60), "US premium color, both tiers");
ok(printingCost("us", "standard-color", true, 50) === null, "standard color isn't printed under 72 pages");
ok(printingCost("us", "black", true, 20) === null, "fewer than 24 pages can't be printed");

ok(royaltyRate("us", 9.98) === 0.5 && royaltyRate("us", 9.99) === 0.6 && royaltyRate("uk", 7.99) === 0.6 && royaltyRate("uk", 7.98) === 0.5, "60% from $9.99 / £7.99, 50% below");
const r = royalty("us", 9.99, 2.84);
ok(near(r.amazon, 0.6 * 9.99 - 2.84) && near(r.expanded, 0.4 * 9.99 - 2.84), "royalty = rate × price − printing", JSON.stringify(r));
ok(royalty("us", 5, 2.84).amazon < 0, "a price too low gives a negative royalty");

ok(near(minimumListPrice("us", 2.84), 5.68), "US floor for $2.84 printing: $5.68 (at 50%)");
ok(near(minimumListPrice("us", 5.2), 9.99), "when 50% would need more than the 60% threshold, the floor is $9.99");
ok(near(minimumListPrice("us", 7), 11.67), "an expensive book's floor is cost ÷ 60%");
ok(royalty("us", minimumListPrice("us", 2.84), 2.84).amazon >= 0, "the floor price never loses money");
ok(near(minimumExpandedPrice(2.84), 7.1), "Expanded Distribution floor is cost ÷ 40%");
const ideas = priceIdeas("us", 2.84);
ok(ideas.length === 3 && near(ideas[0], 5.68) && near(ideas[1], 9.99) && near(ideas[2], 10.99), "price ideas: floor, 60% threshold, charm price", ideas.join());
ok(formatMoney("uk", 1.5) === "£1.50" && formatMoney("eu", -0.2) === "−€0.20", "money is formatted with the market's symbol");

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
