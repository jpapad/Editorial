import { Archivo, JetBrains_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";

// /login sits outside /studio, so it loads the Pagewright fonts itself.
// Archivo goes up to 700 here — the auth design's headings are bold.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${archivo.variable} ${jetBrainsMono.variable} font-pw-sans`}>
      <LanguageProvider>{children}</LanguageProvider>
    </div>
  );
}
