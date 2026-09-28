"use client";

import { useState } from "react";
import BookAssemblyScreen from "@/components/studio/screens/BookAssemblyScreen";
import { createPageFromTemplate } from "@/components/editor/pageTemplates";
import { LEGACY_SPACE } from "@/utils/pageGeometry";
import type { BookPage } from "@/types/editor";

// Verification harness — fixture pages, not real book data (BookAssemblyScreen
// itself is real; this route just isn't wired to a live book).
export default function Page() {
  const [pages, setPages] = useState<BookPage[]>(() => Array.from({ length: 11 }, (_, i) => createPageFromTemplate(i + 1, LEGACY_SPACE)));
  const [activePageId, setActivePageId] = useState(pages[0].id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-8">
      <BookAssemblyScreen
        pages={pages}
        activePageId={activePageId}
        onSelectPage={setActivePageId}
        onReorder={setPages}
        onAddPage={() => {
          const page = createPageFromTemplate(pages.length + 1, LEGACY_SPACE);
          setPages((prev) => [...prev, page]);
        }}
        onDeletePage={(id) => setPages((prev) => prev.filter((p) => p.id !== id))}
      />
    </div>
  );
}
