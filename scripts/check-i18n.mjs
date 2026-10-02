// Lists UI strings that have no Greek translation in src/lib/i18n-el.ts.
//
// Keys come from (1) every t("…") / tx("…") call with a literal, and (2)
// strings translated dynamically via t(label): the `label:` / `hint:` /
// `title:` / `description:` / `name:` fields of the option arrays listed in
// DYNAMIC below, plus a few one-off constants. Run: npm run check:i18n
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const el = fs.readFileSync(path.join(root, "src/lib/i18n-el.ts"), "utf8");
const known = new Set([...el.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)].map((m) => JSON.parse(m[1])));

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(entry.name)) files.push(p);
  }
})(path.join(root, "src"));

// Modules whose option arrays are rendered through t(): their string fields are keys too.
const DYNAMIC = [
  "src/components/studio/editor/AssetPicker.tsx",
  "src/components/editor/stampLibrary.ts",
  "src/components/editor/frameLibrary.ts",
  "src/components/editor/backgroundPatterns.ts",
  "src/components/editor/pageTemplates.ts",
  "src/components/editor/strokeTools.ts",
  "src/components/editor/worksheets.ts",
  "src/components/studio/editor/regions.ts",
  "src/utils/coverTemplates.ts",
  "src/services/bookTexts.ts",
  "src/components/studio/editor/CanvasArea.tsx",
  "src/components/studio/editor/fillPatterns.ts",
  "src/components/studio/editor/keyboard.ts",
  "src/components/studio/editor/RightPanel.tsx",
  "src/components/studio/editor/ToolRail.tsx",
  "src/components/studio/editor/EditorTopBar.tsx",
  "src/components/studio/editor/WorksheetDialog.tsx",
  "src/components/studio/coloring/rewards.tsx",
  "src/components/studio/editor/ageCheck.ts",
  "src/components/studio/coloring/ColoringView.tsx",
  "src/components/studio/screens/OnboardingScreen.tsx",
  "src/components/studio/modals/AiFailureModal.tsx",
  "src/utils/coverGeometry.ts",
  "src/utils/listingKit.ts",
  "src/utils/trimSizes.ts",
];
const EXTRA = [
  // One-off keys passed to t() through variables.
  "My Coloring Book", "All books", "Drafts", "Published", "Loose pages", "Templates", "Saddle stitch",
  "This link doesn't work any more. Ask your teacher for a new one.", "Sharing isn't set up yet.", "Something went wrong. Try again in a moment.",
  "Comments aren't set up yet — run the page_comments migration in Supabase.", "Sharing isn't set up yet — run the book_shares migration in Supabase.",
  "Enter your email address.", "That doesn't look like an email address.", "Choose a password.", "Enter your password.", "Use at least {n} characters.",
  "That email and password don't match. Try again, or create an account.",
  "That link didn't work — it may have expired or been opened in a different browser. Sign in, or request a new one.",
  // AiFailureModal's default cause/explanation/prompt (rendered via t(cause) etc.).
  "The prompt asks for a lot of detail for a “Bold” line", "Thick lines close up small shapes. Try less detail or a thinner line.",
  "a forest with hundreds of leaves, tiny fairies, thick outline",
  // ageCheck advice strings (returned as keys, rendered via t(a)).
  "Draw or place something first.", "Merge or remove the circled areas — they're too small to color at this age.",
  "Use thicker lines (try the “Ages 3–5” or “Bold” brush).", "Simplify: there are more areas than this age will enjoy coloring on one page.",
  "Rectangle", "Circle", "Triangle", "Star", "Heart", "Hexagon", "Line", "Arrow", "Left", "Center", "Right",
];

const keys = new Map(); // key -> first file
const add = (k, f) => k && !keys.has(k) && keys.set(k, path.relative(root, f));
/** The source text of a call's first argument (up to its top-level comma or closing paren). */
function firstArg(src, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) return src.slice(start, i);
      depth--;
    } else if (c === "," && depth === 0) return src.slice(start, i);
  }
  return "";
}

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  // Every string literal in t(…)'s first argument — covers t(cond ? "a" : "b") and t(["a", "b"][i]).
  for (const m of src.matchAll(/\b(?:t|tx)\(/g)) {
    const arg = firstArg(src, m.index + m[0].length);
    for (const s of arg.matchAll(/"((?:[^"\\]|\\.)*)"/g)) add(JSON.parse(`"${s[1]}"`), f);
    for (const s of arg.matchAll(/`([^`$]*)`/g)) add(s[1], f);
  }
}
for (const rel of DYNAMIC) {
  const f = path.join(root, rel);
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\b(?:label|hint|title|description|name):\s*"((?:[^"\\]|\\.)*)"/g)) add(JSON.parse(`"${m[1]}"`), f);
}
for (const k of EXTRA) add(k, "(extra)");

// Brand/format strings that stay as they are in Greek.
const SAME = new Set(["AI", "Pagewright", "PDF", "SVG", "KDP", "Fredoka", "Baloo", "Chewy", "Luckiest Guy", "Patrick Hand", "Arial", "Comic Sans", "Serif", "A–Z", "Α–Ω", "S", "M", "L", "XL"]);
const missing = [...keys].filter(([k]) => !known.has(k) && !SAME.has(k) && /[A-Za-z]/.test(k));
const unused = [...known].filter((k) => !keys.has(k));
if (missing.length) {
  console.log(`${missing.length} string(s) without a Greek translation:`);
  for (const [k, f] of missing) console.log(`  ${JSON.stringify(k)}  ← ${f}`);
}
if (unused.length) console.log(`\n${unused.length} Greek entr${unused.length === 1 ? "y" : "ies"} no longer used:\n  ${unused.map((k) => JSON.stringify(k)).join("\n  ")}`);
console.log(`\n${keys.size} keys scanned, ${known.size} translated.`);
process.exit(missing.length ? 1 : 0);
