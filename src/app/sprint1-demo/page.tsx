import TwoPageSpreadEditor from "@/components/TwoPageSpreadEditor";
import TracingGrid from "@/components/TracingGrid";
import CoverEditor from "@/components/CoverEditor";
import PreflightPanel from "@/components/PreflightPanel";
import ClientApp from "@/app/sprint1-demo/ClientApp";
import ShadowMatchingBuilder from "@/components/ShadowMatchingBuilder";
import GridDrawingComponent from "@/components/GridDrawingComponent";
import CertificateBuilder, { CERTIFICATE_TEMPLATE_PRESETS } from "@/components/CertificateBuilder";
import AutoDotToDot from "@/components/AutoDotToDot";
import SymmetryGridBuilder from "@/components/SymmetryGridBuilder";
import { DEFAULT_BOOK_SETTINGS } from "@/types/book";
import type { BookState, PageSpread } from "@/types/book";
import { calculateCoverDimensions, DEFAULT_COVER_SPEC } from "@/utils/kdpMath";
import type { CoverState, PaperType } from "@/utils/kdpMath";
import { runPreflightCheck } from "@/utils/preflightChecker";

// Deliberately colored (not black-and-white) so the SvgNormalizer output
// visibly proves it strips color and rounds joins — not just passing
// already-clean art through unchanged.
const JELLYFISH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <ellipse cx="100" cy="80" rx="55" ry="45" fill="teal" stroke="teal" stroke-width="4" />
  <circle cx="82" cy="72" r="6" fill="black" />
  <circle cx="118" cy="72" r="6" fill="black" />
  <path d="M60 105 Q40 140 55 170" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
  <path d="M85 112 Q75 150 85 175" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
  <path d="M115 112 Q125 150 115 175" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
  <path d="M140 105 Q160 140 145 170" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
</svg>`.trim();

const CLOWNFISH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <ellipse cx="55" cy="50" rx="35" ry="24" fill="orange" stroke="black" stroke-width="3" />
  <path d="M20 50 L4 34 L4 66 Z" fill="orange" stroke="black" stroke-width="3" stroke-linejoin="round" />
  <path d="M38 27 L38 73" stroke="white" stroke-width="7" />
  <path d="M60 24 L60 76" stroke="white" stroke-width="7" />
  <circle cx="78" cy="44" r="3" fill="black" />
</svg>`.trim();

const CORAL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M50 95 L50 55 M50 55 L28 25 M50 55 L72 22 M50 55 L50 15 M28 25 L18 8 M28 25 L34 5 M72 22 L82 6 M72 22 L62 4"
    stroke="coral" stroke-width="7" fill="none" stroke-linecap="round" />
</svg>`.trim();

// Small trim size just for the flipX/flipY demo below — makes each of the
// 4 side-by-side variants easy to see/screenshot at a glance; the
// DEFAULT_BOOK_SETTINGS 8.5x11 trim used everywhere else would make 4
// side-by-side spreads absurdly wide for what's just a transform check.
const FLIP_DEMO_SETTINGS = { ...DEFAULT_BOOK_SETTINGS, trimWidthIn: 2.5, trimHeightIn: 2.5, bleedIn: 0, gutterIn: 0, outerMarginIn: 0 };

const SAMPLE_SPREAD: PageSpread = {
  id: "spread-1",
  spreadNumber: 1,
  leftPage: {
    id: "page-left",
    elements: [
      {
        id: "title",
        type: "TITLE_TEXT",
        x: 0.25,
        y: 0.35,
        width: 7.875,
        height: 0.6,
        rotation: 0,
        text: "J is for Jellyfish",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 28,
        align: "center",
        fill: "#000000",
      },
      {
        id: "main-art",
        type: "SVG_MAIN_ART",
        x: 1.5,
        y: 1.5,
        width: 5.5,
        height: 5.5,
        rotation: 0,
        svgMarkup: JELLYFISH_SVG,
        strokeWidth: 3,
      },
    ],
  },
  rightPage: {
    id: "page-right",
    elements: [
      {
        id: "letter-guide",
        type: "LETTER_GUIDE",
        x: 2.75,
        y: 0.5,
        width: 3,
        height: 2.8,
        rotation: 0,
        letter: "J",
        fontFamily: "Arial, Helvetica, sans-serif",
        guideStyle: "hollow",
        strokeArrows: [
          { order: 1, x: 1.5, y: 0.25, rotation: 0 },
          { order: 2, x: 0.75, y: 2.4, rotation: -70 },
        ],
      },
      {
        id: "tracing-grid",
        type: "TRACING_GRID",
        x: 0.75,
        y: 3.5,
        width: 6.5,
        height: 2.7,
        rotation: 0,
        letter: "J j",
        fontFamily: "Arial, Helvetica, sans-serif",
        rows: 3,
        repeatsPerRow: 5,
        firstInstanceSolid: true,
      },
      {
        id: "dot-to-dot",
        type: "DOT_TO_DOT",
        x: 0.75,
        y: 6.5,
        width: 3,
        height: 2,
        rotation: 0,
        dotRadius: 0.05,
        showPreviewPath: true,
        vertices: [
          { x: 1.5, y: 0.15 },
          { x: 1.65, y: 0.65 },
          { x: 2.25, y: 0.65 },
          { x: 1.8, y: 1.0 },
          { x: 1.95, y: 1.55 },
          { x: 1.5, y: 1.2 },
          { x: 1.05, y: 1.55 },
          { x: 1.2, y: 1.0 },
          { x: 0.75, y: 0.65 },
          { x: 1.35, y: 0.65 },
        ],
      },
      {
        id: "mini-group",
        type: "SVG_MINI_GROUP",
        x: 4.25,
        y: 6.5,
        width: 3.25,
        height: 2,
        rotation: 0,
        strokeWidth: 2.5,
        items: [
          { id: "mini-clownfish", svgMarkup: CLOWNFISH_SVG, x: 0, y: 0.1, width: 1.4, height: 1.4 },
          { id: "mini-coral", svgMarkup: CORAL_SVG, x: 1.55, y: 0, width: 1.6, height: 1.6 },
          // A real relative-URL fetch (not inline markup) — proves
          // SvgNormalizer's fetch() path works from inside SvgMiniGroup too.
          { id: "mini-star", svgMarkup: "/test-star.svg", x: 3.25 - 1.3, y: 0.15, width: 1.3, height: 1.3 },
        ],
      },
    ],
  },
};

// A deliberately broken second spread — one violation per Sprint 3 rule,
// isolated so each one can be attributed to a specific element rather than
// guessed at. Proves runPreflightCheck() actually catches real problems,
// not just returns an empty array on already-clean data.
const TEST_VIOLATIONS_SPREAD: PageSpread = {
  id: "spread-2-violations",
  spreadNumber: 2,
  leftPage: {
    id: "page-left-violations",
    elements: [
      {
        id: "violation-color",
        type: "TITLE_TEXT",
        x: 0.25,
        y: 0.35,
        width: 7.875,
        height: 0.6,
        rotation: 0,
        text: "TEST PAGE: Intentional Pre-Flight Violations",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 18,
        align: "center",
        fill: "#3b82f6", // blue, not grayscale -> should trigger NON_GRAYSCALE_COLOR
      },
      {
        id: "violation-thin-stroke",
        type: "SVG_MAIN_ART",
        x: 1,
        y: 1.5,
        width: 2,
        height: 2,
        rotation: 0,
        svgMarkup: CORAL_SVG,
        strokeWidth: 0.3, // below the 0.75pt minimum -> should trigger THIN_STROKE
      },
      {
        id: "violation-safe-zone",
        type: "TITLE_TEXT",
        x: 8.0, // left page's gutter starts at 8.125in (trimWidth 8.5 - gutter 0.375)
        y: 4,
        width: 0.4,
        height: 0.3,
        rotation: 0,
        text: "!!",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 14,
        align: "left",
        fill: "#000000", // grayscale on purpose, so this element ONLY trips SAFE_ZONE
      },
    ],
  },
  rightPage: { id: "page-right-violations", elements: [] },
};

const book: BookState = {
  id: "demo-book",
  title: "Ocean Alphabet Coloring & Tracing Book",
  settings: DEFAULT_BOOK_SETTINGS,
  spreads: [SAMPLE_SPREAD, TEST_VIOLATIONS_SPREAD],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const issues = runPreflightCheck(book);

const COVER_PAGE_COUNT = 24;
const COVER_PAPER_TYPE: PaperType = "white";
const coverDims = calculateCoverDimensions(DEFAULT_BOOK_SETTINGS, COVER_PAGE_COUNT, COVER_PAPER_TYPE);

const DEMO_COVER: CoverState = {
  spec: { ...DEFAULT_COVER_SPEC, pageCount: COVER_PAGE_COUNT, paperType: COVER_PAPER_TYPE, backCoverColor: "#ecfeff", frontCoverColor: "#ecfeff" },
  elements: [
    {
      id: "cover-title",
      panel: "front",
      kind: "text",
      x: coverDims.frontCoverX + coverDims.panelWidthIn / 2 - 3,
      y: 1,
      width: 6,
      height: 1.6,
      rotation: 0,
      text: book.title,
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 30,
      align: "center",
      fill: "#000000",
    },
    {
      id: "cover-art",
      panel: "front",
      kind: "art",
      x: coverDims.frontCoverX + coverDims.panelWidthIn / 2 - 2,
      y: 3,
      width: 4,
      height: 4,
      rotation: 0,
      svgMarkup: JELLYFISH_SVG,
      strokeWidth: 3,
    },
  ],
};

export default function Sprint1DemoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-slate-100 py-10">
      <div className="max-w-2xl px-4 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Sprint 1 + 2 + 3 — Verification Demo</h1>
        <p className="mt-1 text-xs text-slate-500">
          Not part of any sprint&apos;s deliverable — a throwaway page confirming everything works together. Spread
          1 is the real activity page; Spread 2 (below the fold) is deliberately broken, one violation per
          Pre-Flight rule, to prove the checker actually catches problems.
        </p>
      </div>

      <h2 className="text-sm font-semibold text-slate-700">Spread 1 — real content</h2>
      <TwoPageSpreadEditor spread={SAMPLE_SPREAD} settings={DEFAULT_BOOK_SETTINGS} showGuides />

      <div className="mt-2 w-full max-w-md rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-center text-xs text-slate-500">
          Greek alphabet support (standalone TracingGrid, not wired into the spread above):
        </p>
        <TracingGrid
          widthIn={4.5}
          heightIn={1.1}
          letter="Ι ι"
          fontFamily="Georgia, 'Times New Roman', serif"
          rows={1}
          repeatsPerRow={4}
          firstInstanceSolid
        />
      </div>

      <h2 className="mt-4 text-sm font-semibold text-slate-700">Spread 2 — intentional Pre-Flight violations</h2>
      <TwoPageSpreadEditor spread={TEST_VIOLATIONS_SPREAD} settings={DEFAULT_BOOK_SETTINGS} showGuides />

      <h2 className="mt-4 text-sm font-semibold text-slate-700">Cover — {coverDims.spineWidthIn}&quot; spine ({COVER_PAGE_COUNT} pages, {COVER_PAPER_TYPE})</h2>
      <CoverEditor cover={DEMO_COVER} settings={DEFAULT_BOOK_SETTINGS} showGuides />

      <h2 className="mt-6 text-sm font-semibold text-slate-700">Sprint 4 — Book Wizard, page reordering, live PDF export</h2>
      <ClientApp />

      <h2 className="mt-6 text-sm font-semibold text-slate-700">Sprint 5 — Shadow Matching worksheet</h2>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ShadowMatchingBuilder
          widthIn={6}
          heightIn={4.5}
          shuffleSeed={7}
          items={[
            { id: "jellyfish", svgMarkup: JELLYFISH_SVG, label: "jellyfish" },
            { id: "clownfish", svgMarkup: CLOWNFISH_SVG, label: "clownfish" },
            { id: "coral", svgMarkup: CORAL_SVG, label: "coral" },
          ]}
        />
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-700">Sprint 5 — Grid copy activity</h2>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <GridDrawingComponent svgMarkup={CLOWNFISH_SVG} referenceWidthIn={2} referenceHeightIn={2} practiceScale={2.5} gridCols={4} gridRows={4} />
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-700">Sprint 5 — Certificate of Completion</h2>
      <CertificateBuilder spec={CERTIFICATE_TEMPLATE_PRESETS.classic} bookTitle={book.title} settings={DEFAULT_BOOK_SETTINGS} />

      <h2 className="mt-6 text-sm font-semibold text-slate-700">Sprint 6 — flipX / flipY (normal, flipX, flipY, both)</h2>
      <div className="flex gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {[
          { label: "normal", flipX: false, flipY: false },
          { label: "flipX", flipX: true, flipY: false },
          { label: "flipY", flipX: false, flipY: true },
          { label: "both", flipX: true, flipY: true },
        ].map(({ label, flipX, flipY }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <TwoPageSpreadEditor
              settings={FLIP_DEMO_SETTINGS}
              showGuides={false}
              spread={{
                id: `flip-demo-${label}`,
                spreadNumber: 1,
                leftPage: {
                  id: `flip-demo-${label}-left`,
                  elements: [
                    { id: `flip-${label}`, type: "SVG_MAIN_ART", x: 0.25, y: 0.25, width: 2, height: 2, rotation: 0, flipX, flipY, svgMarkup: CLOWNFISH_SVG, strokeWidth: 3 },
                  ],
                },
                rightPage: { id: `flip-demo-${label}-right`, elements: [] },
              }}
            />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-700">Sprint 6 — AutoDotToDot (corner-node extraction, not arc-length sampling)</h2>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {/* Same 10-point star shape used to unit-test autoDotToDot(), just in inch-scale coordinates to match widthIn/heightIn below (the earlier 0-100-range test coordinates were for a standalone Node script, not a 3in x 3in on-page box). */}
        <AutoDotToDot
          pathData="M1.5 0.15 L1.83 1.05 L2.85 1.05 L2.04 1.71 L2.37 2.73 L1.5 2.1 L0.63 2.73 L0.96 1.71 L0.15 1.05 L1.17 1.05 Z"
          widthIn={3}
          heightIn={3}
          simplifyToleranceIn={0.02}
          dotRadius={0.06}
          showPreviewPath
        />
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-700">Sprint 6 — Symmetry drawing activity</h2>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <SymmetryGridBuilder svgMarkup={JELLYFISH_SVG} widthIn={5} heightIn={3.5} gridCols={4} gridRows={4} />
      </div>

      {/* Production Pre-Flight Checklist lives inside ClientApp (Sprint 4 section above) instead of
          here, next to the live wizard-generated book — a static instance bound to this page's fixed
          demo `book` would show "all clear" regardless of what the wizard actually generates, which
          is misleading for a readiness gate. */}

      {/* Floating drawer — open by default here only so it's visible in a screenshot; real usage should default closed. */}
      <PreflightPanel issues={issues} defaultOpen />
    </div>
  );
}
