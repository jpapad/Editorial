import { Archivo, JetBrains_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";

// Scoped to /studio only (nested layout) — the root layout keeps loading
// Geist for the three existing editors. Weights match the README's
// typography section exactly: Archivo 400/500/600, JetBrains Mono 400/500.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export default function StudioLayout(props: LayoutProps<"/studio">) {
  return (
    <div className={`${archivo.variable} ${jetBrainsMono.variable} font-pw-sans min-h-screen bg-surface text-ink`}>
      <LanguageProvider>{props.children}</LanguageProvider>
    </div>
  );
}
