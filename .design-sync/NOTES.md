# design-sync notes (Pagewright)

- The repo is a Next.js app, not a published package. `npm run build:ds` (scripts/build-ds.mjs) packages `src/components/studio/ui` as `@pagewright/ui` into `ds-dist/` (git-ignored): esbuild ESM bundle, tsc `.d.ts` (rootDir `src`, so types sit under `types/components/studio/ui/`), compiled Tailwind `pagewright.css`, and `fonts.css` + woff2 from `@fontsource/*`. Always run it before the converter.
- Library entry: `src/components/studio/ui/index.ts` (barrel). A new UI primitive must be exported there to sync.
- CSS: `src/components/studio/ui/design-system.css` imports `src/app/globals.css` and adds what the root layout supplies at runtime (next/font variables `--font-commissioner` / `--font-jetbrains-mono`, and body font/bg/ink). The light/dark `[data-theme]` blocks come with globals.css. Tailwind scans the whole repo (`base: root`), so the compiled CSS holds exactly the utilities the app uses.
- **Only compiled classes exist.** An arbitrary value that the app never uses (e.g. `w-[200px]`) is not in the CSS and silently does nothing. Previews use `style={{ width }}` for one-off sizes. The conventions header tells the design agent the same. Check previews with the class-vs-CSS script (grep each className token in `ds-bundle/_ds_bundle.css`).
- Fonts: Commissioner 400–800 and JetBrains Mono 400/500, latin + greek, the same as `src/app/layout.tsx` (next/font). build-ds copies each `@font-face` from @fontsource's combined `<weight>.css` to keep its `unicode-range`. Without it, the greek face shadows the latin one. Verified both subsets load via `document.fonts`.
- Previews import `lucide-react` icons (an app dependency). They resolve from the repo's node_modules.
- Command: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --out ./ds-bundle` (entry comes from `cfg.entry`).

## Known render warns
- none (StatusDot's `[RENDER_BLANK]` was the unauthored floor render; fixed by the authored preview)

## Re-sync risks
- `design-system.css` duplicates two runtime facts from `src/app/layout.tsx` (font variable names, body shell). If the app changes fonts or shell colours, update it and the `faces` list in scripts/build-ds.mjs. This already happened once (Archivo → Commissioner, 2026-09-30).
- Class availability depends on what the app uses. If a class disappears from the app, it disappears from Claude Design too. Re-validate `.design-sync/conventions.md` class names after big UI refactors.
- The compiled CSS also carries the pre-studio legacy tokens (`--background`, `--foreground`, Geist font vars) from globals.css. They are harmless but unused.
- Theme tokens: components read `--color-*` variables that `[data-theme="dark"]` overrides. `text-on-accent` / `text-on-ink` exist because `bg-accent` and `bg-ink` are light in the dark theme. The conventions header documents this; keep it in sync with globals.css.
- `cn()` (src/utils/cn.ts) extends tailwind-merge with the custom text/radius/shadow/font scales. If you add a token scale to globals.css, add it there too, or `cn` silently drops it (MetaLabel lost its size to this until 2026-09-30).
- The first sync uploaded Archivo woff2 files under `fonts/`. The anchored diff doesn't list them for deletion (it tracks components). They're unreferenced leftovers and harmless.

## Environment
- DesignSync authorization: `/design-login` does not run inside the VS Code extension. Run it once from `claude` in a terminal on this machine. The VS Code session then reuses it.
- Project: "Pagewright", https://claude.ai/design/p/26c43fc8-03e0-476b-ba31-f3a074b77cb0 (pinned in config.json).
