/** Bindery book materials — fonts, trim sizes, page css. */

import { countWords } from "./words";
import type { Manuscript } from "../../domain/types";

export const BINDERY_FONTS: { id: string; label: string; stack: string }[] = [
  { id: "georgia", label: "Georgia", stack: "Georgia, serif" },
  { id: "times", label: "Times New Roman", stack: '"Times New Roman", Times, serif' },
  { id: "palatino", label: "Palatino", stack: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif' },
  { id: "garamond", label: "Garamond", stack: '"EB Garamond", Garamond, "Book Antiqua", serif' },
  { id: "baskerville", label: "Baskerville", stack: '"Libre Baskerville", Baskerville, "Baskerville Old Face", serif' },
  { id: "literata", label: "Literata", stack: 'Literata, Georgia, serif' },
  { id: "sans", label: "Sans serif", stack: "Inter, system-ui, sans-serif" },
];

export const BINDERY_TRIMS: { id: string; label: string }[] = [
  { id: "5x8", label: '5 × 8"' },
  { id: "5.25x8", label: '5.25 × 8"' },
  { id: "5.5x8.5", label: '5.5 × 8.5"' },
  { id: "6x9", label: '6 × 9"' },
  { id: "6.14x9.21", label: '6.14 × 9.21" (digest)' },
  { id: "7x10", label: '7 × 10"' },
];

export function trimToPage(trim: string): string {
  const parts = trim.split("x");
  return `${parts[0]}in ${parts[1]}in`;
}

/** KDP's inside-margin floor by page count — the binding eats more of the
 *  inner edge the thicker the book gets. */
export function kdpGutter(pageCount: number): number {
  if (pageCount <= 150) return 0.375;
  if (pageCount <= 300) return 0.5;
  if (pageCount <= 500) return 0.625;
  if (pageCount <= 700) return 0.75;
  return 0.875;
}

export const inches = (n: number): string => `${Number(n.toFixed(2))}in`;

/** Tschichold-ish proportions (inner : top : outer : bottom ≈ 2 : 3 : 4 : 6)
 *  with the outer margin scaled off the trim width and the inner margin
 *  floored by the KDP gutter. Single-sided pages use the inner margin on
 *  both sides. */
export function pageMargins(trim: string, gutter: number, mirrored: boolean): { inner: number; outer: number; top: number; bottom: number } {
  const width = Number(trim.split("x")[0]);
  const outer = Number((width * 0.0833).toFixed(2));
  const inner = Math.max(Number((outer * 1.5).toFixed(2)), gutter);
  return { inner, outer: mirrored ? outer : inner, top: Number((outer * 1.25).toFixed(2)), bottom: Number((outer * 1.5).toFixed(2)) };
}

export const WORDS_PER_PAGE = 280;

/** Print page count is only knowable after pagination, which happens inside
 *  the print dialog — this is the word-count heuristic, and the UI labels
 *  it as an estimate. */
export function estimatePageCount(manuscript: Manuscript): number {
  const words = manuscript.chapters.reduce((sum, c) => sum + countWords(c.content), 0);
  const front = manuscript.bindery?.frontMatter?.halfTitle ? 2 : 0;
  const chapterOpeners = Math.floor(manuscript.chapters.length / 8);
  return Math.max(1, Math.ceil(words / WORDS_PER_PAGE) + front + chapterOpeners);
}

/** Live book stylesheet driven by the bindery config. */
export function binderyCss(font: string, trim: string, opts: { dropCaps: boolean; runningHead: boolean; pageNumbers?: boolean } | undefined): string {
  const page = trimToPage(trim);
  return [
    `@page { size: ${page}; margin: 0.75in 0.7in;${opts?.pageNumbers ? " @bottom-center { content: counter(page); font-family: Georgia, serif; font-size: 10pt; color: #241c08; }" : ""} }`,
    `.print-book { font-family: ${font}; }`,
    opts?.dropCaps ? `.print-book .chapter > p:first-child::first-letter { font-size: 2.6em; float: left; line-height: 0.8; padding: 0 6px 0 0; font-family: var(--font-display, Georgia, serif); color: #241c08; }` : "",
    opts?.runningHead ? "" : "",
  ].filter(Boolean).join("\n");
}
