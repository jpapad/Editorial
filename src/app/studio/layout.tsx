import { LanguageProvider } from "@/lib/i18n";

// Fonts (Commissioner, JetBrains Mono) and the light/dark theme come from
// the root layout, so /studio, / and /share all share them.
export default function StudioLayout(props: LayoutProps<"/studio">) {
  return (
    <div className="font-pw-sans min-h-screen bg-surface text-ink">
      <LanguageProvider>{props.children}</LanguageProvider>
    </div>
  );
}
