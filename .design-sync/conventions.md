# Pagewright UI: how to build with it

Pagewright is a studio for making printable coloring books. The 2026 look: a dotted workspace, frosted-glass islands floating on it, white paper at the centre, one blue-violet accent. It has a light and a dark theme. Components live on `window.PagewrightUI` (`Button`, `Card`, `MetaLabel`, `Toggle`, `Slider`, `SegmentedControl`, `ColorSwatch`, `StatusDot`, `Thumbnail`).

## Setup
No provider or wrapper is needed. `styles.css` loads the tokens, the fonts (Commissioner for UI text, with full Greek; JetBrains Mono for metadata) and styles `<body>` with Commissioner, the `surface` background and `ink` text.

- **Screen background:** put the root on `pw-workspace` (dotted ground).
- **Floating bars and panels:** use `pw-glass` + a radius + `shadow-panel`. `Card` is already glass.
- **Themes:** light is the default. Add `data-theme="dark"` to the root element (or any container) and every token below switches. Always build with the tokens, never raw hex, so both themes work.
- **Paper stays white in both themes:** `bg-paper`, `Thumbnail`.

## Styling: Tailwind utilities, only the ones that exist
Style layout glue with Tailwind classes. The stylesheet is precompiled, so **a class works only if it is already in `_ds_bundle.css`**:
- Standard utilities (`flex`, `grid`, `gap-*`, `p-*`, `px-*`, `items-center`, `justify-between`, `w-full`…) are there.
- One-off arbitrary values like `w-[200px]` usually are **not**. Use `style={{ width: 200 }}` for one-off sizes.

| Family | Classes (real names) |
|---|---|
| Surfaces | `bg-surface` (app bg), `bg-panel` (cards), `bg-inset`, `bg-inset-alt` (inset controls), `bg-accent-tint` (advisory/active rows), `bg-paper-warm` |
| Text colour | `text-ink`, `text-ink-secondary`, `text-ink-muted` (the lightest allowed for text), `text-accent`, `text-error`, `text-warning` |
| Text on solid fills | `text-on-accent` (on `bg-accent`), `text-on-ink` (on `bg-ink`, `bg-error`, `bg-warning`). **Never `text-white`**: in the dark theme those fills are light. |
| Accent / status | `bg-accent`, `bg-success`, `bg-warning`, `bg-error`, `bg-ink` |
| 2026 surfaces | `pw-workspace` (dotted screen ground), `pw-glass` (frosted island: translucent fill + blur + hairline) |
| Type scale | `text-page-title` 30px, `text-modal-title` 22px, `text-section-title` 17px, `text-card-title` 14px, `text-body` 13.5px, `text-helper` 12px, `text-mono` 10.5px, with `font-medium`, `font-semibold`, `font-bold` or `font-extrabold` |
| Fonts | `font-pw-sans` (Commissioner), `font-pw-mono` (JetBrains Mono) |
| Radius | `rounded-pill` (buttons, chips), `rounded-panel` 22px (cards), `rounded-panel-sm`, `rounded-row` / `rounded-row-sm` (list rows), `rounded-paper` / `rounded-paper-sm` (page thumbnails) |
| Shadow | `shadow-resting`, `shadow-panel` (cards), `shadow-toolbar` (floating bars), `shadow-paper` |
| Lines | `border-hairline` (rarely; prefer shadow) |

Raw tokens for inline styles (they follow the theme; light / dark values): `var(--color-accent)` #4453d6 / #9aa8ff, `var(--color-ink)` #14151a / #edeef2, `var(--color-surface)` #eef0f4 / #0f1013, `var(--color-hairline)` #e1e3ea / #2c2e36, `var(--radius-panel)`, `var(--shadow-panel)`, `var(--shadow-paper)`.

## House rules
- Depth comes from glass and shadows (`pw-glass`, `shadow-panel`), not heavy borders.
- Use one `primary` Button per group, placed last. Use `secondary` for the rest, `ghost` for low emphasis and `dark` for a few strong non-accent actions.
- Metadata (counts, sizes, page numbers, status) always uses `MetaLabel`, which is mono, uppercase and letter-spaced. Don't hand-style it.
- `Card` has no padding of its own. Add `p-4` (or `p-1.5` for row lists).
- A `StatusDot` always sits next to text and never carries meaning alone.
- Page/art placeholders are `Thumbnail` without `src`, which shows the striped pattern. Don't draw fake clip art.

## Where the truth lives
- `styles.css` → `_ds_bundle.css`: every token (`:root`) and every available class.
- `components/general/<Name>/<Name>.d.ts`: props.
- `<Name>.prompt.md`: usage.

## Example
```jsx
const { Card, Button, MetaLabel, Toggle } = window.PagewrightUI;

<div data-theme="dark" className="pw-workspace flex flex-col gap-3 p-6" style={{ width: 312 }}>
  <Card className="flex flex-col gap-2.5 p-4">
    <div className="flex items-center justify-between">
      <p className="text-card-title font-semibold text-ink">Book print</p>
      <MetaLabel>8.5 × 11 in</MetaLabel>
    </div>
    <Toggle checked onChange={() => {}} label="Print to the edge (bleed)" />
    <p className="text-helper text-ink-muted">Pages extend 0.125 in past the trim.</p>
    <Button variant="secondary" size="sm">Amazon listing kit</Button>
  </Card>
  <Card tone="accent" className="flex flex-col gap-1.5 p-4">
    <MetaLabel tone="accent">Print check</MetaLabel>
    <p className="text-body text-ink">2 pages have art inside the trim margin.</p>
  </Card>
</div>
```
