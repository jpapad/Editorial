"use client";

import { useEffect, useRef, useState } from "react";
import type { TFunction } from "@/lib/i18n";
import { BookConflictError, saveBook, type StoredBook } from "@/utils/storage";
import type { BookPage, CoverDesign } from "@/types/editor";

const AUTOSAVE_DEBOUNCE_MS = 500;

/** The book as the editor holds it right now (updatedAt is set at save time). */
export type BookDraft = Omit<StoredBook, "updatedAt" | "ownerId" | "collection">;

/**
 * Saves the book half a second after the last change. Saves run one after
 * another (each needs the previous one's version to check against), and
 * each sends the latest state, not the state from when it was queued. If
 * someone else saved the book in between, autosave stops and `conflict`
 * is set — the user then reloads their version or keeps this one
 * (`saveNow(true)`).
 *
 * `prepare` turns the pages into what is stored (big pictures uploaded and
 * replaced by links).
 */
export function useBookAutosave({ enabled, initialUpdatedAt, draft, prepare, t }: { enabled: boolean; initialUpdatedAt: string | null; draft: BookDraft; prepare: (pages: BookPage[], cover: CoverDesign | null) => Promise<{ pages: BookPage[]; cover?: CoverDesign | null }>; t: TFunction }) {
  const [conflict, setConflict] = useState(false);
  // Last version of the book this tab knows about: a save only goes through if nobody saved since.
  const lastSavedAtRef = useRef<string | null>(initialUpdatedAt);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const latestRef = useRef({ draft, prepare, t });
  useEffect(() => {
    latestRef.current = { draft, prepare, t };
  });

  function saveNow(force = false) {
    chainRef.current = chainRef.current.then(async () => {
      const { draft: book, prepare: toStored, t: tr } = latestRef.current;
      const stored = await toStored(book.pages, book.cover ?? null);
      const updatedAt = new Date().toISOString();
      try {
        await saveBook({ ...book, pages: stored.pages, cover: stored.cover, updatedAt }, { expectedUpdatedAt: force ? null : lastSavedAtRef.current });
        lastSavedAtRef.current = updatedAt;
        if (force) setConflict(false);
      } catch (err) {
        if (err instanceof BookConflictError) setConflict(true);
        else window.alert(err instanceof Error ? err.message : tr("Could not save this book."));
      }
    });
  }

  const { id, title, pages, status, trimSize, bleed, paper, cover } = draft;
  useEffect(() => {
    if (!enabled || conflict) return;
    const timer = setTimeout(() => saveNow(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, conflict, id, title, pages, status, trimSize, bleed, paper, cover]);

  return { conflict, saveNow };
}
