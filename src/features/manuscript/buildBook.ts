import type { Manuscript } from "../../domain/types";
import { renderMarkdown } from "../entries/markdown";
import { defaultBindery } from "../../data/schema";
import { useScriptorium } from "../../data/store";

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
  const b = { ...defaultBindery(), ...(manuscript.bindery ?? {}) } as NonNullable<Manuscript["bindery"]>;
  const author = manuscript.author
    ? `<p class="book-author">${escapeText(manuscript.author)}</p>`
    : "";
  const front = b.titlePage
    ? `<section class="front-matter"><div class="title-page"><p class="tp-series">Scriptorium</p><h1 class="tp-title">${escapeText(manuscript.title)}</h1>${manuscript.author ? `<p class="tp-author">${escapeText(manuscript.author)}</p>` : ""}</div></section>`
    : "";
  const dedication = b.dedication
    ? `<section class="front-matter dedication">${escapeText(b.dedication)}</section>`
    : "";
  const tocRow = (chapter: Manuscript["chapters"][number]) =>
    `<li class="toc-row"><span>${escapeText(chapter.heading)}</span><span class="toc-dot" aria-hidden="true"></span></li>`;
  const toc = b.toc
    ? `<section class="front-matter toc"><h2>Conteúdo</h2><ul>${chapters.map(tocRow).join("")}</ul></section>`
    : "";
  const glossary = b.glossary ? glossaryFor(manuscript) : "";
  const sections = chapters
    .map((chapter, i) => {
      const body = chapter.content
        ? renderMarkdown(chapter.content)
        : EMPTY_PARAGRAPH;
      const head = b.runningHead
        ? `<span class="running-head" data-ch-index="${i + 1}">${escapeText(manuscript.title)}</span>`
        : "";
      return `${head}<section class="chapter"><h2>${escapeText(chapter.heading)}</h2>${body}</section>`;
    })
    .join("");
  return `<article class="book">${front}${dedication}${toc}<h1 class="book-title">${escapeText(manuscript.title)}</h1>${author}${sections}${glossary}</article>`;
}


/** Glossary = entries with a summary (term + short definition), assembled
 *  from the project's códex — the Bindery feature line. */
export function glossaryFor(manuscript: Manuscript): string {
  const state = useScriptorium.getState();
  const projectId = manuscript.projectId;
  const entries = state.entries
    .filter((e) => e.projectId === projectId && (e.summary ?? "").trim())
    .map((e) => `<tr data-glossary="${e.id}"><td>${escapeText(e.title)}</td><td>${escapeText((e.summary ?? "").trim().slice(0, 200))}</td></tr>`);
  if (!entries.length) return "";
  return `<section class="back-matter glossary"><h2>Glossário</h2><table><tbody>${entries.join("")}</tbody></table></section>`;
}
