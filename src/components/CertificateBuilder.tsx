import type { BookSettings } from "@/types/book";
import SvgNormalizer from "@/components/SvgNormalizer";

export type CertificateBorderStyle = "classic" | "playful" | "none";

export interface CertificateSpec {
  title: string;
  /** Supports the `{{bookTitle}}` token (see interpolateCertificateBody). */
  bodyTemplate: string;
  signatureLabel: string;
  includeDateLine: boolean;
  accentColor: string; // hex
  borderStyle: CertificateBorderStyle;
  /** Optional decorative badge/ribbon art — normalized like any other line art, via SvgNormalizer. */
  badgeSvgMarkup?: string;
}

export const DEFAULT_RIBBON_BADGE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">
  <circle cx="50" cy="42" r="34" />
  <circle cx="50" cy="42" r="22" />
  <path d="M28 68 L18 112 L50 96 L82 112 L72 68" />
</svg>`.trim();

export const CERTIFICATE_TEMPLATE_PRESETS: Record<string, CertificateSpec> = {
  classic: {
    title: "Certificate of Completion",
    bodyTemplate: "This certifies that the reader above has proudly completed every page of\n“{{bookTitle}}”",
    signatureLabel: "Parent / Teacher Signature",
    includeDateLine: true,
    accentColor: "#1e3a8a",
    borderStyle: "classic",
    badgeSvgMarkup: DEFAULT_RIBBON_BADGE_SVG,
  },
  playful: {
    title: "You Did It!",
    bodyTemplate: "Way to go! You finished every activity in\n“{{bookTitle}}” — great job!",
    signatureLabel: "Grown-Up Signature",
    includeDateLine: true,
    accentColor: "#ea580c",
    borderStyle: "playful",
    badgeSvgMarkup: DEFAULT_RIBBON_BADGE_SVG,
  },
};

/**
 * Replaces the `{{bookTitle}}` token in a template. There is deliberately
 * no `{{childName}}` token: this renders into a mass-printed KDP interior
 * page, not a one-off personalized document, so the recipient's name can
 * never be known at print time — it always prints as a blank line for the
 * child to fill in by hand (see the recipient line in the component below).
 */
export function interpolateCertificateBody(template: string, bookTitle: string): string {
  return template.replaceAll("{{bookTitle}}", bookTitle);
}

export interface CertificateBuilderProps {
  spec: CertificateSpec;
  bookTitle: string;
  settings: BookSettings;
  /** Which side of the spread this page falls on — only affects which edge the gutter guide sits on. */
  side?: "left" | "right";
  showGuides?: boolean;
}

const RECIPIENT_LINE_COLOR = "#94a3b8"; // slate-400
const BODY_TEXT_COLOR = "#334155"; // slate-700

/**
 * Renders a single full trim-size page — a "Certificate of Completion" —
 * meant to be placed as the book's final page. Standalone rather than part
 * of the PageSpread/CanvasElement model, the same way CoverEditor renders
 * outside that model: a certificate is one page, not a left+right spread,
 * and its layout (border, badge, signature/date lines) doesn't map onto
 * the existing coloring/tracing element types.
 */
export default function CertificateBuilder({ spec, bookTitle, settings, side = "right", showGuides = true }: CertificateBuilderProps) {
  const { trimWidthIn, trimHeightIn, bleedIn, gutterIn } = settings;
  const bodyLines = interpolateCertificateBody(spec.bodyTemplate, bookTitle).split("\n");
  const borderInset = 0.4;
  const borderColor = spec.borderStyle === "none" ? "transparent" : spec.accentColor;

  return (
    <div
      className="relative shrink-0 overflow-hidden bg-white shadow-lg"
      style={{ width: `${trimWidthIn}in`, height: `${trimHeightIn}in` }}
    >
      {spec.borderStyle !== "none" && (
        <div
          className="pointer-events-none absolute"
          style={{
            inset: `${borderInset}in`,
            border: `${spec.borderStyle === "classic" ? "3pt double" : "2.5pt solid"} ${borderColor}`,
            borderRadius: spec.borderStyle === "playful" ? "0.3in" : undefined,
          }}
          aria-hidden
        />
      )}

      <div className="absolute flex flex-col items-center text-center" style={{ inset: `${borderInset + 0.35}in` }}>
        {spec.badgeSvgMarkup && (
          <SvgNormalizer
            src={spec.badgeSvgMarkup}
            mode="line"
            strokeColor={spec.accentColor}
            strokeWidthPt={3}
            targetWidthIn={1.1}
            targetHeightIn={1.3}
          />
        )}

        <span className="mt-3" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "30pt", color: spec.accentColor }}>
          {spec.title}
        </span>

        <span className="mt-6" style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "11pt", color: BODY_TEXT_COLOR }}>
          is presented to
        </span>

        {/* Blank recipient line — see interpolateCertificateBody's note on why there's no name token. */}
        <div className="mt-2 border-b" style={{ width: "4.5in", borderColor: RECIPIENT_LINE_COLOR }} />

        <div className="mt-6 flex flex-col gap-1">
          {bodyLines.map((line, i) => (
            <span key={i} style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "13pt", color: BODY_TEXT_COLOR }}>
              {line}
            </span>
          ))}
        </div>

        <div className="mt-auto flex w-full items-end justify-between px-4 pb-2">
          <div className="flex flex-col items-center">
            <div className="border-b" style={{ width: "2.2in", borderColor: RECIPIENT_LINE_COLOR }} />
            <span className="mt-1" style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9pt", color: BODY_TEXT_COLOR }}>
              {spec.signatureLabel}
            </span>
          </div>
          {spec.includeDateLine && (
            <div className="flex flex-col items-center">
              <div className="border-b" style={{ width: "1.6in", borderColor: RECIPIENT_LINE_COLOR }} />
              <span className="mt-1" style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "9pt", color: BODY_TEXT_COLOR }}>
                Date
              </span>
            </div>
          )}
        </div>
      </div>

      {showGuides && (
        <>
          <div className="pointer-events-none absolute border border-dashed border-red-400/70" style={{ inset: `-${bleedIn}in` }} aria-hidden />
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-0 border-r border-dashed border-sky-400/70"
            style={side === "left" ? { right: `${gutterIn}in` } : { left: `${gutterIn}in` }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
