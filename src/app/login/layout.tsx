import { LanguageProvider } from "@/lib/i18n";

// Fonts and theme come from the root layout.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-pw-sans">
      <LanguageProvider>{children}</LanguageProvider>
    </div>
  );
}
