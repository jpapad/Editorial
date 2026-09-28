import { resolveCharacters } from "@/lib/fontEngine";
import { resolveContentProvider } from "@/lib/contentProvider";
import type { BookState, BookWizardConfig, KdpPrintSpec, PageSpread, WizardLetterContent } from "@/types/kdpBook";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** An honest "no art yet" placeholder — still real SVG_MAIN_ART content (proves the pipeline), never fabricated/mismatched clip art. */
function buildPlaceholderArtSvg(word: string, widthIn: number, heightIn: number): string {
  const w = widthIn * 100;
  const h = heightIn * 100;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect x="${w * 0.05}" y="${h * 0.05}" width="${w * 0.9}" height="${h * 0.9}" rx="12" fill="none" stroke="black" stroke-width="3" stroke-dasharray="12 8" />
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${w * 0.045}" fill="black">Illustration pending:</text>
  <text x="${w / 2}" y="${h / 2 + w * 0.07}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${w * 0.06}" font-weight="bold" fill="black">${word}</text>
</svg>`.trim();
}

function buildAlphabetSpread(
  spreadNumber: number,
  content: WizardLetterContent,
  config: BookWizardConfig,
  printSpec: KdpPrintSpec
): PageSpread {
  const { trimWidthIn, outerMarginIn, gutterIn } = printSpec;
  const leftSafeWidth = trimWidthIn - outerMarginIn - gutterIn;
  const rightSafeWidth = trimWidthIn - gutterIn - outerMarginIn;

  const artWidth = leftSafeWidth * 0.85;
  const artHeight = artWidth;

  return {
    id: makeId("spread"),
    spreadNumber,
    leftPage: {
      id: makeId("page"),
      elements: [
        {
          id: makeId("title"),
          type: "TITLE_TEXT",
          x: outerMarginIn,
          y: 0.35,
          width: leftSafeWidth,
          height: 0.6,
          rotation: 0,
          text: `${content.character} is for ${content.vocabWord}`,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 28,
          align: "center",
          fill: "#000000",
        },
        {
          id: makeId("art"),
          type: "SVG_MAIN_ART",
          x: outerMarginIn + (leftSafeWidth - artWidth) / 2,
          y: 1.5,
          width: artWidth,
          height: artHeight,
          rotation: 0,
          svgMarkup: content.svgMarkup ?? buildPlaceholderArtSvg(content.vocabWord, artWidth, artHeight),
          strokeWeight: 3,
        },
      ],
    },
    rightPage: {
      id: makeId("page"),
      elements: [
        {
          id: makeId("letter-guide"),
          type: "LETTER_GUIDE",
          x: gutterIn + (rightSafeWidth - 3) / 2,
          y: 0.4,
          width: 3,
          height: 3,
          rotation: 0,
          letter: content.character,
          fontFamily: config.fontFamily,
          guideStyle: "hollow",
          strokeArrows: [{ order: 1, x: 1.5, y: 0.1, rotation: 0 }],
        },
        {
          id: makeId("tracing-grid"),
          type: "TRACING_GRID",
          x: gutterIn,
          y: 3.8,
          width: rightSafeWidth,
          height: 2.6,
          rotation: 0,
          letter: content.character,
          fontFamily: config.fontFamily,
          traceStyle: config.traceStyle,
          rows: config.rows,
          repeatsPerRow: config.repeatsPerRow,
          firstInstanceSolid: true,
        },
      ],
    },
  };
}

export function generateBookFromTopic(config: BookWizardConfig, printSpec: KdpPrintSpec): BookState {
  const provider = resolveContentProvider(config.topic);
  const characters = resolveCharacters(config.characterSet);

  const spreads = characters.map((character, index) => {
    const content: WizardLetterContent = provider.getLetterContent(config.topic, character) ?? {
      character,
      vocabWord: `${character}-word`,
      svgMarkup: null,
    };
    return buildAlphabetSpread(index + 1, content, config, printSpec);
  });

  return {
    id: makeId("book"),
    title: `${capitalize(config.topic)} Alphabet Coloring & Tracing Book`,
    printSpec,
    spreads,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
