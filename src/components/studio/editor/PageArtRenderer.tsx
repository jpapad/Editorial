"use client";

// Keeps every page's art (utils/pageArt.ts) up to date in the background:
// once editing has paused, the next page whose lines changed is drawn on a
// hidden canvas — the editor's own renderer, so it looks exactly like the
// page — captured, uploaded to <user>/art/ in Storage (apart from the user's
// own pictures), and its link written onto the page. One page at a time; the
// next is picked when that one is done. Signed out, or with
// Storage not set up, it stops for the session (uploadBookImage returns null).

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type Konva from "konva";
import CanvasEditor, { capturePageArt } from "@/components/editor/CanvasEditor";
import { waitForNextPaint, waitForPictures } from "@/components/studio/editor/editorHelpers";
import { uploadBookImage } from "@/lib/imageUploader";
import { nextPageForArt, pageArtKey, PAGE_ART_MAX_PX } from "@/utils/pageArt";
import type { BookPage, PageSpace } from "@/types/editor";

/** How long the pages must stay unchanged before art is made — so it never competes with drawing. */
export const PAGE_ART_IDLE_MS = 4000;

const noop = () => {};

export function usePageArt({ pages, setPages, space, enabled }: { pages: BookPage[]; setPages: Dispatch<SetStateAction<BookPage[]>>; space: PageSpace; enabled: boolean }): ReactNode {
  const [job, setJob] = useState<{ page: BookPage; key: string } | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const failed = useRef(new Set<string>());
  const off = useRef(false);

  // The next page to draw, once the pages have stayed the same for a moment.
  useEffect(() => {
    if (!enabled || job || off.current) return;
    const timer = setTimeout(() => {
      const page = nextPageForArt(pages, failed.current);
      if (page) setJob({ page, key: pageArtKey(page) });
    }, PAGE_ART_IDLE_MS);
    return () => clearTimeout(timer);
  }, [enabled, job, pages]);

  // Draw, capture, upload; the link goes on the page only if it still shows what was drawn.
  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    void (async () => {
      try {
        await waitForNextPaint();
        const stage = stageRef.current;
        if (!stage || cancelled) return;
        await waitForPictures(stage, job.page);
        if (cancelled) return;
        const url = await uploadBookImage(capturePageArt(stage, PAGE_ART_MAX_PX), "art");
        if (cancelled) return;
        if (!url) {
          off.current = true;
          return;
        }
        setPages((prev) => prev.map((p) => (p.id === job.page.id && pageArtKey(p) === job.key ? { ...p, artUrl: url, artKey: job.key } : p)));
      } catch {
        failed.current.add(job.page.id);
      } finally {
        if (!cancelled) setJob(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job, setPages]);

  if (!job) return null;
  const pageSpace = job.page.space ?? space;
  return (
    <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, width: pageSpace.width, height: pageSpace.height, opacity: 0, pointerEvents: "none" }}>
      <CanvasEditor
        page={job.page}
        space={pageSpace}
        tool="pen"
        strokeWidth={6}
        pendingPlacement={null}
        selectedIds={[]}
        showGrid={false}
        showGuides={false}
        mode="draw"
        backgroundPatternId={job.page.backgroundPatternId}
        isCover={job.page.isCover}
        coverBackgroundColor={job.page.coverBackgroundColor}
        onSelectObject={noop}
        onSelectIds={noop}
        onAddLines={noop}
        onPlaceObject={noop}
        onUpdateObjects={noop}
        onTextDragStateChange={noop}
        onStageReady={(stage) => {
          stageRef.current = stage;
        }}
        scale={1}
      />
    </div>
  );
}
