import type { Chapter, Manuscript, Part } from "../../domain/types";
import { renderMarkdown } from "../entries/markdown";
import { defaultBindery } from "../../data/schema";
import { useScriptorium } from "../../data/store";
import { BINDERY_FONTS, trimToPage } from "./bindery";

const EMPTY_PARAGRAPH = '<p class="empty">No content yet.</p>';

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordNumber(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return n % 10 === 0 ? TENS[Math.floor(n / 10)] : `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}`;
  return String(n);
}

export function chapterNumber(style: NonNullable<Manuscript["bindery"]>["numberingStyle"], n: number): string {
  if (style === "none") return "";
  if (style === "chapter") return `Chapter ${n}`;
  if (style === "word") return wordNumber(n);
  return String(n);
}

function escapeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Book body plan: the ungrouped run first (by order), then one block per
 *  part (parts by order, chapters by order). Chapter numbers, data-ch, the
 *  chN named pages and the TOC all walk this same sequence. A chapter whose
 *  partId names a missing part counts as ungrouped so no text drops out. */
export function bookSections(manuscript: Manuscript): { part: Part | null; chapters: Chapter[] }[] {
  const parts = [...(manuscript.parts ?? [])].sort((a, b) => a.order - b.order);
  const chapters = [...manuscript.chapters].sort((a, b) => a.order - b.order);
  const partIds = new Set(parts.map((p) => p.id));
  return [
    { part: null, chapters: chapters.filter((c) => !c.partId || !partIds.has(c.partId)) },
    ...parts.map((part) => ({ part, chapters: chapters.filter((c) => c.partId === part.id) })),
  ];
}

/** Copyright page: only the lines that have content ever print. */
export function copyrightPage(manuscript: Manuscript, config: NonNullable<Manuscript["bindery"]>): string {
  const info = config.frontMatter?.copyrightInfo ?? {};
  const holder = info.holder?.trim() || manuscript.author;
  const lines = [
    info.year && holder ? `© ${escapeText(info.year)} ${escapeText(holder)}` : "",
    escapeText(info.rights?.trim() || "All rights reserved."),
    info.edition ? `${escapeText(info.edition)} edition` : "",
    info.isbn ? `ISBN ${escapeText(info.isbn)}` : "",
    "Cover and interior set in Scriptorium.",
  ].filter(Boolean).map((line) => `<p>${line}</p>`).join("");
  return `<section class="front-matter copyright display">${lines}</section>`;
}

/** Half title: the book title alone. Markup only — the front-matter switch
 *  lives with the caller (print and EPUB both read `fm.halfTitle`). */
export function halfTitleSection(manuscript: Manuscript): string {
  return `<section class="front-matter half-title display"><h1 class="ht-title">${escapeText(manuscript.title)}</h1></section>`;
}

/** Dedication page: configured text, escaped; empty when off. */
export function dedicationSection(config: NonNullable<Manuscript["bindery"]>): string {
  return config.dedication
    ? `<section class="front-matter dedication display">${escapeText(config.dedication)}</section>`
    : "";
}

/** Epigraph page: configured markdown, sanitized through renderMarkdown;
 *  empty when off. */
export function epigraphSection(config: NonNullable<Manuscript["bindery"]>): string {
  return config.frontMatter?.epigraph?.trim()
    ? `<section class="front-matter epigraph display">${renderMarkdown(config.frontMatter.epigraph.trim())}</section>`
    : "";
}

/** One chapter's heading: the h2 with its print-style number. */
function chapterHeading(config: NonNullable<Manuscript["bindery"]>, chapter: Chapter, n: number): string {
  const num = chapterNumber(config.numberingStyle ?? "arabic", n);
  const numHtml = num ? `<span class="ch-num">${escapeText(num)}</span>` : "";
  return `<h2>${numHtml}${escapeText(chapter.heading)}</h2>`;
}

/** One chapter's body: markdown (or the empty placeholder), top note, scene
 *  marker, end note. */
function chapterBody(chapter: Chapter): string {
  let body = chapter.content
    ? renderMarkdown(chapter.content)
    : EMPTY_PARAGRAPH;
  if (chapter.noteTop?.trim()) {
    body = `<div class="chapter-note top">${renderMarkdown(chapter.noteTop.trim())}</div>` + body;
  }
  if (chapter.endMarker?.trim()) {
    // a punctuation marker (* * *, •) becomes the scene ornament; a line
    // carrying letters or digits is the writer's own words and prints as
    // written, styled like the ornament
    body = body + (/[\p{L}\p{N}]/u.test(chapter.endMarker.trim())
      ? `<div class="scene-marker text">${escapeText(chapter.endMarker.trim())}</div>`
      : `<div class="scene-marker ornament" aria-hidden="true"></div>`);
  }
  if (chapter.noteEnd?.trim()) {
    body = body + `<div class="chapter-note bottom">${renderMarkdown(chapter.noteEnd.trim())}</div>`;
  }
  return body;
}

/** One chapter's inner markup: the heading then the body. The EPUB wraps
 *  this whole in one section; print splits it across the opener section
 *  (the heading, on its own page when a head or folio is suppressed) and
 *  the body section, so both formats read the same pieces. */
export function chapterInner(config: NonNullable<Manuscript["bindery"]>, chapter: Chapter, n: number): string {
  return chapterHeading(config, chapter, n) + chapterBody(chapter);
}

/** Part divider's inner markup: the part's own number, title and epigraph.
 *  `num` is the already-rendered numbering label ("" when numbering is off). */
export function partInner(part: Part, num: string): string {
  return (
    (num ? `<p class="part-num">${escapeText(num)}</p>` : "") +
    `<h1 class="part-title">${escapeText(part.title)}</h1>` +
    (part.epigraph?.trim() ? `<div class="part-epigraph">${renderMarkdown(part.epigraph.trim())}</div>` : "")
  );
}

/** Whole-book HTML: front matter (half title, title, copyright, dedication,
 *  epigraph, TOC with part rows), then the body plan's sections, then the
 *  back matter (glossary, about the author, colophon). Content flows through
 *  renderMarkdown (already sanitized); the plain-string pieces
 *  (title/author/headings) are escaped here. */
export function buildBookHtml(manuscript: Manuscript): string {
  const b = { ...defaultBindery(), ...(manuscript.bindery ?? {}) } as NonNullable<Manuscript["bindery"]>;
  const fm = b.frontMatter ?? { halfTitle: false, copyright: false, romanNumerals: false };
  const numbering = b.numberingStyle ?? "arabic";
  const halfTitle = fm.halfTitle ? halfTitleSection(manuscript) : "";
  // The title always opens the book on its own sheet: with the title page on,
  // the branded page carries it (no second book-title before the chapters);
  // without it, a centered book-title page stands in.
  const titleBlock = b.titlePage
    ? `<section class="front-matter title-page display"><p class="tp-series">Scriptorium</p><h1 class="tp-title">${escapeText(manuscript.title)}</h1>${manuscript.author ? `<p class="tp-author">${escapeText(manuscript.author)}</p>` : ""}</section>`
    : `<section class="front-matter book-title-page display"><h1 class="book-title">${escapeText(manuscript.title)}</h1>${manuscript.author ? `<p class="book-author">${escapeText(manuscript.author)}</p>` : ""}</section>`;
  const copyright = fm.copyright ? copyrightPage(manuscript, b) : "";
  const dedication = dedicationSection(b);
  const epigraph = epigraphSection(b);
  const sections = bookSections(manuscript);
  const tocRow = (chapter: Chapter, n: number) => {
    const num = chapterNumber(numbering, n);
    const numHtml = num ? `<span class="toc-num">${escapeText(num)}</span>` : "";
    return `<li class="toc-row">${numHtml}<span>${escapeText(chapter.heading)}</span><span class="toc-dot" aria-hidden="true"></span></li>`;
  };
  // one walk keeps the three chapter consumers in agreement: the flat chapter
  // number feeds data-ch (and the chN named pages built from the same list),
  // the TOC rows and the divider numbering feeds both divider and TOC row
  const tocRows: string[] = [];
  const body: string[] = [];
  let chapterNo = 0;
  let partNo = 0;
  sections.forEach(({ part, chapters }) => {
    if (part) {
      partNo += 1;
      const num = chapterNumber(numbering, partNo);
      const numHtml = num ? `<span class="toc-num">${escapeText(num)}</span>` : "";
      tocRows.push(`<li class="toc-row toc-part">${numHtml}<span>${escapeText(part.title)}</span></li>`);
      body.push(`<section class="part-divider" data-part="${partNo}">${partInner(part, num)}</section>`);
    }
    chapters.forEach((c) => {
      chapterNo += 1;
      tocRows.push(tocRow(c, chapterNo));
      // one HTML shape for print: the opener section (heading) then the body
      // section; the generated CSS decides whether they share a page
      body.push(
        `<section class="chapter-opener" data-ch="${chapterNo}">${chapterHeading(b, c, chapterNo)}</section>` +
        `<section class="chapter" data-ch="${chapterNo}">${chapterBody(c)}</section>`,
      );
    });
  });
  const toc = b.toc
    ? `<section class="front-matter toc"><h2>Contents</h2><ul>${tocRows.join("")}</ul></section>`
    : "";
  return `<article class="book">${halfTitle}${titleBlock}${copyright}${dedication}${epigraph}${toc}${body.join("")}${backMatterFor(manuscript, b)}</article>`;
}


/** Colophon font name: the label of the configured stack, or the first
 *  (house) label when the stack is not one of the known ones. */
function fontLabel(stack: string): string {
  return BINDERY_FONTS.find((f) => f.stack === stack)?.label ?? BINDERY_FONTS[0].label;
}

/** About the author section: only when the configured bio has content. */
export function aboutAuthorSection(config: NonNullable<Manuscript["bindery"]>): string {
  const bio = config.backMatter?.aboutAuthor?.trim();
  return bio
    ? `<section class="back-matter about-author"><h2>About the author</h2><p>${escapeText(bio)}</p></section>`
    : "";
}

/** Colophon: configured font label and trim, only when the switch is on. */
export function colophonSection(config: NonNullable<Manuscript["bindery"]>): string {
  return config.backMatter?.colophon
    ? `<section class="back-matter colophon"><p>Set in ${escapeText(fontLabel(config.font))}.</p><p>Trim ${escapeText(trimToPage(config.trim))} · Scriptorium.</p></section>`
    : "";
}

/** Back matter after the body: glossary (one effective switch — the v2 block
 *  wins, the legacy glossary field is the fallback for old saved data), then
 *  about the author and the colophon, each only when configured. */
function backMatterFor(manuscript: Manuscript, config: NonNullable<Manuscript["bindery"]>): string {
  const glossary = (config.backMatter?.glossary ?? config.glossary ?? false) ? glossaryFor(manuscript) : "";
  return glossary + aboutAuthorSection(config) + colophonSection(config);
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
  return `<section class="back-matter glossary"><h2>Glossary</h2><table><tbody>${entries.join("")}</tbody></table></section>`;
}
