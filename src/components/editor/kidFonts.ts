// Text-tool typefaces. The kid-friendly faces come from Google Fonts under
// their real family names ("Fredoka", not a build-hashed next/font name),
// because the family string is stored inside each saved TextData — it has
// to keep resolving in every future build, not just this one.
//
// Loaded on demand by the editor only (ensureKidFonts), then explicitly
// requested via document.fonts.load: Konva draws to a <canvas>, which never
// triggers a web font download on its own.

export interface FontOption {
  label: string;
  value: string;
  /** Google Fonts family for loading; absent for system fonts. */
  google?: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { label: "Fredoka", value: '"Fredoka", "Comic Sans MS", cursive', google: "Fredoka:wght@600" },
  { label: "Baloo", value: '"Baloo 2", "Comic Sans MS", cursive', google: "Baloo+2:wght@700" },
  { label: "Chewy", value: '"Chewy", "Comic Sans MS", cursive', google: "Chewy" },
  { label: "Luckiest Guy", value: '"Luckiest Guy", Impact, sans-serif', google: "Luckiest+Guy" },
  { label: "Patrick Hand", value: '"Patrick Hand", "Comic Sans MS", cursive', google: "Patrick+Hand" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Comic Sans", value: '"Comic Sans MS", "Comic Sans", cursive' },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
];

let loading: Promise<void> | null = null;

/** Adds the Google Fonts stylesheet once and asks the browser to actually fetch each face. Resolves when they're usable (or failed — system fallbacks then apply). */
export function ensureKidFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (loading) return loading;

  const families = FONT_OPTIONS.flatMap((f) => (f.google ? [`family=${f.google}`] : [])).join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  // The @font-face rules only exist once the stylesheet has loaded; asking
  // document.fonts.load() before that finds nothing to load.
  const sheetReady = new Promise<void>((resolve) => {
    link.onload = () => resolve();
    link.onerror = () => resolve();
  });
  document.head.appendChild(link);

  loading = sheetReady.then(() =>
    Promise.all(FONT_OPTIONS.filter((f) => f.google).map((f) => document.fonts.load(`32px ${f.value}`).catch(() => []))).then(() => undefined)
  );
  return loading;
}
