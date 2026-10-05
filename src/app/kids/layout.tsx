import { LanguageProvider } from "@/lib/i18n";

// The children's side of classes and families. Public: children have no
// accounts (see sql/10_kid_groups.sql). Fonts and theme come from the root layout.
export default function KidsLayout(props: { children: React.ReactNode }) {
  return (
    <div className="font-pw-sans min-h-screen bg-surface text-ink">
      <LanguageProvider>{props.children}</LanguageProvider>
    </div>
  );
}
