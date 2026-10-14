import type { Manuscript } from "../../domain/types";
import { renderMarkdown } from "../entries/markdown";

const EMPTY_PARAGRAPH = '<p class="empty">Sem conteúdo ainda.</p>';

function escapeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Whole-book HTML: title + optional author + every chapter sorted by order.
 *  Content flows through renderMarkdown (already sanitized); the plain-string
 *  pieces (title/author/headings) are escaped here. */
export function buildBookHtml(manuscript: Manuscript): string {
  const chapters = [...manuscript.chapters].sort((a, b) => a.order - b.order);
  const author = manuscript.author
    ? `<p class="book-author">${escapeText(manuscript.author)}</p>`
    : "";
  const sections = chapters
    .map((chapter) => {
      const body = chapter.content
        ? renderMarkdown(chapter.content)
        : EMPTY_PARAGRAPH;
      return `<section class="chapter"><h2>${escapeText(chapter.heading)}</h2>${body}</section>`;
    })
    .join("");
  return `<article class="book"><h1 class="book-title">${escapeText(manuscript.title)}</h1>${author}${sections}</article>`;
}
