// Builds src/components/studio/ui as a standalone library in ds-dist/
// (git-ignored) for the Claude Design sync (.design-sync/):
//   index.js        ESM bundle, React external
//   types/          .d.ts for every component
//   pagewright.css  compiled Tailwind: tokens + every utility the app uses
//   fonts.css + fonts/  self-hosted Commissioner and JetBrains Mono (@fontsource)
// Usage: npm run build:ds
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "ds-dist");
const ui = path.join(root, "src/components/studio/ui");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "fonts"), { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
fs.writeFileSync(
  path.join(out, "package.json"),
  JSON.stringify({ name: "@pagewright/ui", version: pkg.version, type: "module", module: "index.js", types: "types/components/studio/ui/index.d.ts", style: "pagewright.css", peerDependencies: { react: "^19" } }, null, 2) + "\n"
);

await esbuild.build({
  entryPoints: [path.join(ui, "index.ts")],
  outfile: path.join(out, "index.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
  tsconfig: path.join(root, "tsconfig.json"),
  logLevel: "warning",
});

// Declarations for the barrel and everything it reaches.
const tsconfig = path.join(out, "tsconfig.types.json");
fs.writeFileSync(
  tsconfig,
  JSON.stringify({
    extends: path.join(root, "tsconfig.json"),
    compilerOptions: { noEmit: false, declaration: true, emitDeclarationOnly: true, incremental: false, rootDir: path.join(root, "src"), outDir: path.join(out, "types"), baseUrl: root, plugins: [] },
    include: [path.join(ui, "*.ts"), path.join(ui, "*.tsx"), path.join(root, "src/utils/cn.ts")],
  })
);
execFileSync(path.join(root, "node_modules/.bin/tsc"), ["-p", tsconfig], { stdio: "inherit", cwd: root });
fs.rmSync(tsconfig);

const cssIn = path.join(ui, "design-system.css");
const css = await postcss([tailwind({ base: root })]).process(fs.readFileSync(cssIn, "utf8"), { from: cssIn });
fs.writeFileSync(path.join(out, "pagewright.css"), css.css);

// Same families, weights and subsets as the app's next/font setup
// (app/layout.tsx): Commissioner + JetBrains Mono, latin + greek. Each
// @font-face is copied from @fontsource's combined <weight>.css so it keeps
// its unicode-range; without it the greek face would shadow the latin one.
const faces = [
  ["commissioner", [400, 500, 600, 700, 800]],
  ["jetbrains-mono", [400, 500]],
];
const SUBSETS = ["latin", "greek"];
let fontsCss = "";
for (const [id, weights] of faces) {
  for (const w of weights) {
    const src = fs.readFileSync(path.join(root, "node_modules/@fontsource", id, `${w}.css`), "utf8");
    for (const subset of SUBSETS) {
      const block = src.match(new RegExp(`/\\* ${id}-${subset}-${w}-normal \\*/\\s*(@font-face \\{[^}]*\\})`));
      if (!block) throw new Error(`@fontsource/${id}: no ${subset} ${w} face`);
      const file = `${id}-${subset}-${w}-normal.woff2`;
      fs.copyFileSync(path.join(root, "node_modules/@fontsource", id, "files", file), path.join(out, "fonts", file));
      fontsCss += block[1].replace(/src:[^;]*;/, `src: url("./fonts/${file}") format("woff2");`) + "\n";
    }
  }
}
fs.writeFileSync(path.join(out, "fonts.css"), fontsCss);
console.log(`ds-dist/ built: index.js, types/, pagewright.css (${(css.css.length / 1024).toFixed(0)} KB), ${fs.readdirSync(path.join(out, "fonts")).length} fonts`);
