# Handoff: Coloring Book Editor — UI

## Overview
UI design for a web + tablet coloring-book editor. Three audiences: creators assembling printable/sellable books, illustrators converting artwork to line art, and teachers/parents making classroom pages — plus a stripped-down coloring view for end users. 21 screens/states across three design rounds.

## About the Design Files
`Coloring Editor Mockups.dc.html` is a **design reference written in HTML**, not production code. It is a single streaming component file with all styling inline; do not copy its markup. The task is to **recreate these screens in the target codebase** (React/Vue/SwiftUI/etc.) using its existing component library, routing, and state patterns. If no frontend exists yet, pick the framework that fits the project and implement there.

Open the file in a browser. It is laid out as a design canvas: three `<section>` blocks (turns), newest at top. Every option has a visible id badge (`3a`, `2b`, `1a`…) — use those ids to refer to screens.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii and shadows. Recreate pixel-closely, but substitute the codebase's own primitives (Button, Card, Slider, Toggle) where they exist.

Exception: all artwork is a **striped placeholder** (`repeating-linear-gradient(135deg,#eceae6 0 6px,#f8f7f4 6px 12px)`). Real line art has not been supplied. Treat those blocks as image slots.

## The design system to implement (decided in turn 3)
**Light shell everywhere; dark only immediately around the drawing canvas.**

- Surfaces: app background `#f1f2f5`, cards/panels `#fff`, inset controls `#eceef2` / `#f2f4f7`, hairline `#e6e9ee`.
- Ink: primary `#10141a`, secondary `#40485a`, muted `#6b7280` (do **not** go lighter than this for text — earlier greys failed 4.5:1).
- Accent: `#3357d4` (light shell). The dark canvas shell uses `#5b8cff` on `#0b0d10`–`#1c2128`.
- Paper: `#fff` / `#fdfcfa`, warm tablet ground `#f2f0ec`.
- Semantic: success `#7a9e7e`, warning `#e0a13c`, error `#c4453f`.
- Palette swatches used in mocks: `#e4b7a0 #cfa77e #8fae8b #5d7f6f #d9cf9e #b98a8a #7b8fa8 #42505f #efe6da #c9c2b6 #8c7a6b`.

### Typography
- `Archivo` (400/500/600) for all UI text. `JetBrains Mono` (400/500) for metadata, units, status labels — always uppercase with `letter-spacing:.08–.1em`, 9–10px.
- Scale in use: 26px/600 page title · 21px/600 modal title · 15–16px/600 section title · 12.5–13px/600 card title · 11.5px/400–500 body · 10.5px/400 helper · 9–10px mono.
- Body line-height 1.5–1.6; headings 1.1–1.25 with `letter-spacing:-.02em`.

### Shape & depth
- Radii: 999px for all buttons/pills/chips/swatches · 20px tool rails · 16–18px panels · 12–14px list rows and tiles · 8–10px paper and thumbnails.
- Borders are avoided in the modern shell — depth comes from shadow: resting `0 1px 2px rgba(16,20,26,.06)`, panel `0 1px 2px rgba(16,20,26,.06), 0 8px 24px rgba(16,20,26,.05)`, floating toolbar `0 2px 6px rgba(16,20,26,.08), 0 12px 30px rgba(16,20,26,.09)`, paper `0 2px 6px rgba(16,20,26,.08), 0 18px 44px rgba(16,20,26,.1)`. Dark shell: `0 10px 30px rgba(0,0,0,.35)` + `inset 0 1px 0 rgba(255,255,255,.05)`.
- Selection is a ring, never a border swap: `box-shadow:0 0 0 2px <accent>` (+ `0 0 0 4px rgba(51,87,212,.16)` on swatches).
- Spacing scale: 4 / 6 / 9 / 14 / 18 / 22 / 26px. Panel padding 15–16px, screen padding 18–22px, grid gaps 11–16px.

## Screens
Grouped by round. Ids match the badges in the file.

### Turn 3 — final direction (build these)
**3a · Coloring view (end user, tablet landscape)**
Purpose: relaxed coloring, zero chrome. Tablet bezel `#15181d`, 34px radius, 16px padding; screen radius 22px on `#f2f0ec`.
Layout: 46px top bar (back chevron + book/page title left; "Quiet mode" pill `#eceef2`-equivalent `rgba(16,20,26,.06)` + primary "Save" pill right) · centered paper 376×428, white, 6px radius, 18px padding · 104px bottom zone with a floating white pill toolbar and a mono caption under it.
Toolbar: 8 palette circles 38px (selected gets `0 0 0 3px #fff, 0 0 0 5px #3357d4`), a "+" circle `#f2f4f7`, 1px `#e6e9ee` divider, then three 44px action circles (fill = `#10141a` with white dot; brush; undo). **44px is the hit-target floor — keep it.**
Copy: "Sleepy Fox · Forest Friends", "Quiet mode", "Save", "ΣΕΛΙΔΑ 7 ΑΠΟ 24 · ΣΥΡΕ ΓΙΑ ΕΠΟΜΕΝΗ".
Behavior: tap a region to flood-fill with the selected color; swipe left/right for prev/next page; long-press to sample; Quiet mode hides the top bar and dims the shell. Autosave.

**3b · Import scan → line art** (780×520 modal)
Header: title + mono source line ("FOX_SKETCH.JPG · 2480 × 3508 · 300 DPI"), secondary "Άκυρο" + primary "Προσθήκη στο βιβλίο".
Body: two equal preview panes (original `#e7e4df`, result striped with `0 0 0 2px #3357d4` ring) with mono captions; right panel 232px white card holding: Threshold slider (0.42), Line weight slider (2.8 pt), three toggles (Despeckle ON, Close open shapes ON, Keep shading OFF), Detail preservation slider (72%) with helper text, and a `#e8edfb` hint card.
Behavior: every control re-traces the result pane live (debounce ~200ms); "Close open shapes" is what makes tap-to-fill work, so it defaults ON.

**3c · AI generating** (460×440): 2×2 tile grid — 2 complete, 1 in progress (4px progress bar + "ΓΡΑΜΜΕΣ 58%"), 1 queued (`#e9ebef`, "ΣΕ ΑΝΑΜΟΝΗ"). "~20 ΔΕΥΤ." estimate in header. Actions: "Στο παρασκήνιο" (primary-weight white pill) + "Διακοπή". Generation must survive navigating away.

**3d · AI failure** (460×440): title "Δεν μπόρεσα να φτιάξω αυτή τη σελίδα"; a reason card with a red dot, a headline cause and an explanation; a card echoing the user's prompt; **two one-tap remedies** ("Δοκίμασε με «Medium» γραμμή", "Χώρισέ το σε 2 σελίδες") each with an "Εφαρμογή" link; footer "Δοκίμασε ξανά" (dark pill) + "ΔΕΝ ΧΡΕΩΘΗΚΕ CREDIT". Never show a raw error code; always offer a remedy and refund the credit.

**3e · Preflight blocking export** (620×480): header with red mono "3 ΘΕΜΑΤΑ · 2 ΜΠΛΟΚΑΡΟΥΝ ΤΟ EXPORT" and a **disabled** Export pill (`#e9ebef` bg, `#9aa1ab` text). Left column: three issue cards, each a dot (red = blocking, amber = warning), cause, explanation and an "auto-fix" link. Right column 150px: flagged page thumbnails ringed red/amber with mono labels, and a hint card. Export enables only when zero blocking issues remain.
Rules encoded: art entering bleed = blocking; page count not a multiple of 4 (saddle stitch) = blocking; strokes < 0.5 pt = warning.

**3f · Empty library** (620×440): three fanned page cards (rotated −6°/0/+6°), 24px/600 headline, 12.5px body, three pills ("Νέο βιβλίο" primary, "Από template", "Import σκίτσου"), plus a sample-book line.

**3g · EN/EL density check** — not a screen to build; it documents that Greek labels need short words. Use "Σχέδιο / Χρώμα / Σελίδες" for the Draw/Color/Assemble segmented control; "Συναρμολόγηση" does not fit a 264px panel. Budget ~20% extra width for Greek in dense panels.

### Turn 2 — the modern shell (the editor to build)
**2b · Editor, light shell (canonical, 1200×700)** — implement this one.
- 18px page padding on `#f1f2f5`. Floating top bar: absolute, 18px insets, height 56, radius 18, white, panel shadow; left = 26px accent logo square (radius 9) + book title 13px/600 + mono page/size line; right = a segmented pill group inside `#eceef2` 3px padding (active = `#10141a` bg, white text), "Export" pill `#eceef2`, "Publish" pill `#3357d4`/white.
- Left tool rail: 64px wide, `margin-top:88px`, radius 20, white, `height:fit-content`, 12px vertical padding, 6px gap; items are 44px squares radius 14 (active = accent, icon white; idle = `#f2f4f7`, icon `#5d6673`); a 26px hairline, then an AI item on `#e8edfb` with accent glyph + 7px mono "AI".
- Center column: `flex:1; min-width:0; margin-top:88px`, column, 14px gap. Canvas area `flex:1; min-height:0` centering paper 392×462 (white, radius 8, 20px padding, dashed accent bleed guide inset 12px, striped art inside). A floating pill toolbar overlaps the canvas bottom: stroke slider + "2.4PT", divider, "SMOOTH 68%", divider, accent dot + "SYMMETRY".
- Page filmstrip: `flex:none; height:92px`, radius 18, white, horizontal; 44×58 thumbnails radius 5, current one ringed accent, trailing "+" tile. **`flex:none` is required** — without it the strip collapses to 0 in a fixed-height column.
- Right column 264px, `margin-top:88px`, 14px gap: Layers card (26px radius-8 swatch + name + mono meta; active row on `#e8edfb`), Palette card (6-col grid of round swatches, 7px gap, ring on selected), and a `#e8edfb` advisory card with a primary pill ("Thicken all").

**2a** is the same layout in the dark shell (`radial-gradient(120% 90% at 50% 0%,#15191f,#0b0d10)`, panels `rgba(28,33,40,.72)`, accent `#5b8cff`, ink `#f1f4f8`) — ship it as a theme, not a second layout.

**2c · Library, modern** (940×632): 196px sidebar (nav items as pills, active = white + shadow; mono "COLLECTIONS" label at `#6b7280`) + content with 26px/600 "All books", mono count, "Import art" white pill and "New book" accent pill; 4-col grid of white cards (10px padding, radius 16) each wrapping a 3:4 thumbnail (radius 10) and a title + mono meta; status chip ("DRAFT") is an accent pill top-left of the thumbnail; last tile is a dashed `#cfd5de` "NEW BOOK" placeholder.

### Turn 1 — earlier round, dark dense chrome (reference only)
`1a` docked-panel editor, `1b` floating-toolbar editor, `1c` radial tool wheel, `1d` library, `1e` templates gallery, `1f` AI generate, `1g` book assembly, `1h` palette manager, `1i` export & print settings, `1j` onboarding, `1k` share & publish.
**Still needed as screens, but restyle to the turn-2 light shell.** Their content/IA is correct and worth reading:
- `1g` assembly: 6-col page grid, drag to reorder with a dashed drop target, cover/blank markers, footer validation strip ("multiple of 4").
- `1h` palettes: expanded active palette (34px swatches, hex + CMYK readout), collapsed palette rows with 4-swatch previews, "extract palette from an image" row.
- `1i` export: format radio list (Print PDF CMYK 300dpi / Digital PDF RGB / PNG per page ZIP), trim + bleed fields, crop-marks / single-sided / flatten toggles, right-side preflight preview with dot list.
- `1j` onboarding: "STEP 1 OF 3", four intent rows (sell/print · classroom · convert artwork · just color) that preset trim, line weight and export defaults; "Skip setup".
- `1k` publish: cover + listing card, destination list (public link / classroom pack 30 copies / print-on-demand PDF), copyable URL row, Save draft + Publish.
- `1c`'s radial wheel is worth keeping as a **tablet-only** gesture (hold to summon at the touch point).

## Interactions & behavior
- Mode switch Draw / Color / Assemble drives the whole editor: tool rail contents, right-panel stack, and canvas hit behavior.
- Draw: pointer events with pressure (`PointerEvent.pressure`) for Pencil; stroke smoothing slider 0–100%; symmetry axis mirrors input live; shift constrains to straight.
- Color: tap/click a closed region → flood fill on the active layer beneath the locked line-art layer. Line art is always locked by default.
- Layers: reorder, opacity, lock, hide. Line art on top, flat color under, texture under that, guides non-printing.
- Filmstrip and assembly grid: drag to reorder with a dashed drop indicator; the dragged thumbnail keeps an accent ring.
- AI: generate 4 options at once; tiles stream in independently (queued → rendering with % → done); "More like this" re-rolls from a chosen tile; failures return remedies, not codes; credits shown in header, refunded on failure.
- Export: blocked until preflight has zero blocking issues; each issue has an auto-fix mutation.
- Transitions: 120–160ms ease-out for hover/press, 200–240ms for panel and modal entry. Fills animate in ~120ms. Respect `prefers-reduced-motion`.
- Hover (pointer devices only): surfaces lift one shadow step; idle tool items go `#f2f4f7` → `#eceef2`; pills darken ~4%. Press scales 0.98.
- Focus: 2px `#3357d4` ring at 2px offset on every interactive element.
- Autosave with a mono "AUTOSAVED 2M AGO" style indicator.
- Responsive: panels are fixed-width (64 / 196 / 232 / 264px) and the canvas column absorbs the rest. Under ~1100px collapse the right column into a bottom sheet; under ~820px go full-bleed canvas with the floating toolbars from `1b`/`3a`.

## State
- `book`: id, title, trimSize, bleed, binding, pages[]
- `page`: id, kind (art | blank | cover), layers[], artRef, flags[]
- `layer`: id, kind (lineart | flat | texture | guides), opacity, locked, visible
- `editor`: mode, activeTool, strokeWidth, smoothing, symmetry, zoom, activePageId, activeLayerId, activeSwatch
- `palettes`: id, name, swatches[{hex, cmyk}], usageCount
- `ai`: jobId, prompt, lineWeight, detail, tiles[{status, progress, imageRef}], creditsLeft, error{cause, remedies[]}
- `preflight`: issues[{severity, pageId, code, message, autoFix}] — recompute on page change; export enabled when no `severity:blocking`.
- `import`: sourceFile, threshold, lineWeight, despeckle, closeShapes, keepShading, detail, resultRef

## Assets
None supplied. All artwork is a placeholder gradient. Needed: 2–3 real line-art pages (SVG preferred — vector is assumed by the "all art vector" preflight check), an app logo (currently a 26px accent rounded square), and an icon set (tool glyphs in the mocks are abstract shapes standing in for pen/fill/line/mask/select/undo).

Fonts: Archivo and JetBrains Mono, both Google Fonts.

Product name "Pagewright" is a placeholder.

## Screenshots
`screenshots/` holds one PNG per screen at 1x, named by option id:
`2b-editor-light.png` (the editor to build) · `2a-editor-dark.png` (dark theme) · `2c-library.png` · `3a-coloring-view.png` · `3b-import-scan.png` · `3c-ai-generating.png` · `3d-ai-error.png` · `3e-preflight.png` · `3f-empty-library.png` · `1g-book-assembly.png` · `1h-palettes.png` · `1i-export-print.png` · `1j-onboarding.png` · `1k-publish.png`.
Turn-1 shots (`1g`–`1k`) show the old dark chrome — take their **content and IA**, restyle to the turn-2 light shell.

## Files
- `Coloring Editor Mockups.dc.html` — all 21 screens/states. Open in a browser; scroll from the top (turn 3 = final direction).

## Suggested prompt for the coding agent
Paste this into the IDE agent, with the folder in the repo:

> Read `design_handoff_coloring_editor/README.md` end to end, then open `design_handoff_coloring_editor/Coloring Editor Mockups.dc.html` in a browser and look at `design_handoff_coloring_editor/screenshots/`. These are **design references**, not code to copy — the HTML is a single inline-styled prototype file.
>
> First, survey this repo and tell me what already exists: framework, styling approach, component library, routing, state management, and which of these screens are already partly built. Do not write code yet. Propose a plan mapping each screen in the README to files you would create or change, and list anything in the design that conflicts with existing patterns.
>
> After I approve the plan, implement in this order, stopping after each step for review:
> 1. Design tokens from the README's "design system" section, in whatever form this repo already uses for theming. Include both the light shell and the dark canvas theme.
> 2. Shared primitives: pill Button (primary/secondary/disabled), panel Card, SegmentedControl, Slider, Toggle, ColorSwatch, Thumbnail, mono MetaLabel, StatusDot. Every screen is built from these — no one-off styling later.
> 3. Screen `2b`, the editor shell, with the mode switch, tool rail, canvas area, page filmstrip and right panel stack. Note the filmstrip needs `flex:none` in the fixed-height column or it collapses.
> 4. Screen `3a`, the end-user coloring view, including 44px minimum hit targets and swipe-to-page.
> 5. States `3c`, `3d`, `3e`, `3f` and the import flow `3b`.
> 6. Screens `1g`, `1h`, `1i`, `1j`, `1k`, `2c` — content as designed, restyled to the light shell.
>
> Rules: match the README's exact hex values, type scale, radii and shadows; use this repo's own primitives and conventions over anything in the prototype's markup; no new dependencies without asking; keep all artwork as image slots (no generated SVG art); text never lighter than `#6b7280`; add a focus ring to every interactive element; respect `prefers-reduced-motion`. Greek labels must stay short — see `3g` in the README.
>
> Flag rather than invent: if a behaviour is not specified, ask me instead of guessing.
