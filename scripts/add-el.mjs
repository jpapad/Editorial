// Adds Greek translations from a JSON file ({ "English": "Ελληνικά" }) to src/lib/i18n-el.ts, skipping keys already there.
import fs from "node:fs";
const file = new URL("../src/lib/i18n-el.ts", import.meta.url);
const add = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let src = fs.readFileSync(file, "utf8");
const known = new Set([...src.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)].map((m) => JSON.parse(m[1])));
const lines = Object.entries(add).filter(([k]) => !known.has(k)).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`).join("");
const end = src.trimEnd().lastIndexOf("};");
fs.writeFileSync(file, src.slice(0, end) + lines + src.slice(end));
console.log(`added ${lines.split("\n").length - 1} translations`);
