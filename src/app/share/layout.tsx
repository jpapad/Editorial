import { Archivo, JetBrains_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";

// Same fonts as /studio: share links render the same coloring board.
// (Scoped per route like /studio — the root layout keeps loading
// Geist for the three existing editors.)

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

export default function ShareLayout(props: { children: React.ReactNode }) {
  return (
    <div className={`${archivo.variable} ${jetBrainsMono.variable} font-pw-sans min-h-screen bg-surface text-ink`}>
      <LanguageProvider>{props.children}</LanguageProvider>
    </div>
  );
}
