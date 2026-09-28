import { Fredoka } from "next/font/google";
import KidsColoringViewer from "@/components/interactive/KidsColoringViewer";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"] });

// A simple flower line-art page for testing the interactive player. Fill is
// "none" everywhere except a couple of solid black details — the interior of
// every shape must stay transparent so the kid's paint shows through it.
const FLOWER_LINE_ART_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 900">
  <line x1="60" y1="860" x2="640" y2="860" stroke="black" stroke-width="8" stroke-linecap="round" />
  <rect x="336" y="520" width="28" height="330" rx="14" fill="none" stroke="black" stroke-width="8" />
  <ellipse cx="300" cy="650" rx="70" ry="34" fill="none" stroke="black" stroke-width="8" transform="rotate(-25 300 650)" />
  <ellipse cx="400" cy="720" rx="70" ry="34" fill="none" stroke="black" stroke-width="8" transform="rotate(25 400 720)" />
  <ellipse cx="350" cy="260" rx="55" ry="95" fill="none" stroke="black" stroke-width="8" transform="rotate(0 350 380)" />
  <ellipse cx="350" cy="260" rx="55" ry="95" fill="none" stroke="black" stroke-width="8" transform="rotate(60 350 380)" />
  <ellipse cx="350" cy="260" rx="55" ry="95" fill="none" stroke="black" stroke-width="8" transform="rotate(120 350 380)" />
  <ellipse cx="350" cy="260" rx="55" ry="95" fill="none" stroke="black" stroke-width="8" transform="rotate(180 350 380)" />
  <ellipse cx="350" cy="260" rx="55" ry="95" fill="none" stroke="black" stroke-width="8" transform="rotate(240 350 380)" />
  <ellipse cx="350" cy="260" rx="55" ry="95" fill="none" stroke="black" stroke-width="8" transform="rotate(300 350 380)" />
  <circle cx="350" cy="380" r="55" fill="none" stroke="black" stroke-width="8" />
</svg>`.trim();

const FLOWER_LINE_ART_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(FLOWER_LINE_ART_SVG)}`;

export default function PlayPage() {
  return (
    <div
      className={`${fredoka.className} flex min-h-screen flex-col items-center gap-8 bg-gradient-to-br from-sky-300 via-fuchsia-300 to-amber-200 px-4 py-10`}
    >
      <KidsColoringViewer lineArtSrc={FLOWER_LINE_ART_SRC} title="Color the Flower! 🌸" />
    </div>
  );
}
