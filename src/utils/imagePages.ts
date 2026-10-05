// Turning a generated/imported image into book content: a stamp that fills
// the page's safe area, an optional caption under it, or a whole new page.
// Shared by the editor (series, "fill page") and the library's
// book-from-description flow.

import { createPageFromTemplate, makeId } from "@/components/editor/pageTemplates";
import { geometryFromSpace, type PageGeometry } from "@/utils/pageGeometry";
import type { BookPage, PageSpace, StampData, TextData } from "@/types/editor";

export interface ImageSize {
  width: number;
  height: number;
}

/** Room kept under a full-page picture for its caption. */
export const CAPTION_SPACE = 90;

/** A stamp scaled to fill the page's safe area (keeping its aspect ratio) and centered — leaving `captionSpace` free at the bottom. */
export function fullPageStamp(src: string, size: ImageSize, geo: PageGeometry, captionSpace = 0): StampData {
  const { safe } = geo;
  const availW = safe.right - safe.left;
  const availH = safe.bottom - safe.top - captionSpace;
  const k = Math.min(availW / size.width, availH / size.height);
  const width = size.width * k;
  const height = size.height * k;
  return {
    kind: "stamp",
    id: makeId("stamp"),
    src,
    x: safe.left + (availW - width) / 2,
    y: safe.top + (availH - height) / 2,
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    filter: "none",
  };
}

export function captionText(text: string, geo: PageGeometry): TextData {
  const width = geo.safe.right - geo.safe.left;
  return {
    kind: "text",
    id: makeId("text"),
    text,
    fontFamily: '"Fredoka", "Comic Sans MS", cursive',
    fontSize: 44,
    align: "center",
    x: geo.safe.left,
    y: geo.safe.bottom - CAPTION_SPACE + 18,
    width,
    height: 62,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fill: "#111827",
    isDragging: false,
    outline: true,
  };
}

/** A new page holding just this picture (and its caption, if given). */
export function pageFromImage(src: string, size: ImageSize, space: PageSpace, caption?: string): BookPage {
  const geo = geometryFromSpace(space);
  const page = createPageFromTemplate(0, space);
  page.objects = caption ? [fullPageStamp(src, size, geo, CAPTION_SPACE), captionText(caption, geo)] : [fullPageStamp(src, size, geo)];
  return page;
}

/** Room kept under the picture of a story page for its text (a share of the safe area's height). */
export const STORY_TEXT_SHARE = 0.26;

/** A story page: the picture on top, one or two sentences of the story below it, left to color around. */
export function storyPageFromImage(src: string, size: ImageSize, space: PageSpace, story: string): BookPage {
  const geo = geometryFromSpace(space);
  const { safe } = geo;
  const textSpace = Math.round((safe.bottom - safe.top) * STORY_TEXT_SHARE);
  const fontSize = story.length > 140 ? 24 : story.length > 80 ? 28 : 32;
  const text: TextData = {
    kind: "text",
    id: makeId("text"),
    text: story,
    fontFamily: '"Fredoka", "Comic Sans MS", cursive',
    fontSize,
    align: "center",
    x: safe.left + 12,
    y: safe.bottom - textSpace + 16,
    width: safe.right - safe.left - 24,
    height: textSpace - 24,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fill: "#111827",
    isDragging: false,
  };
  const page = createPageFromTemplate(0, space);
  page.objects = [fullPageStamp(src, size, geo, textSpace), text];
  return page;
}
