"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ColoringBoard } from "@/components/studio/coloring/ColoringView";
import { getSharedBook, isMissingSharesTable } from "@/utils/shares";
import { deviceGet, deviceSet } from "@/utils/deviceStore";
import { convertPages, interiorSpace } from "@/utils/pageGeometry";
import type { BookPage, PageSpace } from "@/types/editor";
import { useT } from "@/lib/i18n";

/** What this device remembers per page: only the child's own work. */
type Progress = Record<string, Pick<BookPage, "fillDataUrl" | "completedAt" | "thumbnailDataUrl">>;

type State =
  | { kind: "loading" }
  | { kind: "missing"; message: string } // an English i18n key, translated at render
  | { kind: "ready"; title: string; pages: BookPage[]; space: PageSpace };

/** /share/<token>: the book's pages, colored and saved on this device only — nothing goes back to the book. */
export default function SharedColoring() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const t = useT();
  const storeKey = `share:${token}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const book = await getSharedBook(token);
        if (!book || book.pages.length === 0) {
          if (!cancelled) setState({ kind: "missing", message: "This link doesn't work any more. Ask your teacher for a new one." });
          return;
        }
        const space = interiorSpace(book.trim_size ?? undefined, book.bleed);
        const pages = await convertPages(book.pages, space);
        const saved = (await deviceGet<Progress>(`share:${token}`)) ?? {};
        const merged = pages.map((p) => ({ ...p, ...saved[p.id] }));
        if (!cancelled) setState({ kind: "ready", title: book.title, pages: merged, space });
      } catch (err) {
        const message = err instanceof Error && isMissingSharesTable(err.message) ? "Sharing isn't set up yet." : "Something went wrong. Try again in a moment.";
        if (!cancelled) setState({ kind: "missing", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-surface text-body text-ink-secondary">{t("Loading…")}</div>;
  }
  if (state.kind === "missing") {
    return <div className="flex min-h-screen items-center justify-center bg-surface p-8 text-center text-body text-ink-secondary">{t(state.message)}</div>;
  }

  return (
    <ColoringBoard
      title={state.title}
      initialPages={state.pages}
      space={state.space}
      backHref={null}
      save={(pages) => {
        const progress: Progress = {};
        for (const p of pages) {
          if (p.fillDataUrl || p.completedAt) progress[p.id] = { fillDataUrl: p.fillDataUrl, completedAt: p.completedAt, thumbnailDataUrl: p.thumbnailDataUrl };
        }
        return deviceSet(storeKey, progress);
      }}
    />
  );
}
