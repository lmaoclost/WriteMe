/** Generated print stylesheet — page geometry, mirrored margins, folio,
 *  chapter openers (sink, suppressed head/folio) and running heads
 *  (book-wide head on the base page, or per-chapter named pages).
 *  Ordered geometry first, then typography; structure rules land here too. */

import type { BinderyConfig, Part } from "../../domain/types";
import { inches, kdpGutter, pageMargins, trimToPage } from "./bindery";

export interface BookCtx {
  title: string;
  chapters: { heading: string; partId?: string }[];
  parts: Part[];
  pageCount: number;
}

/** CSS string literal: escape backslashes and quotes for content: "...". */
const cssStr = (text: string) => text.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const BASE = (config: BinderyConfig) => ({
  bodyPt: config.typography?.bodyPt ?? 11,
  leading: config.typography?.leading ?? 14.5,
  indent: config.typography?.indent ?? 1,
  justify: config.typography?.justify ?? true,
  hyphens: config.typography?.hyphens ?? false,
  mirrored: config.geometry?.mirrored ?? true,
});

export function buildBookCss(config: BinderyConfig, ctx: BookCtx): string {
  const t = BASE(config);
  const gutter = config.geometry?.gutter === "auto" || config.geometry?.gutter === undefined
    ? kdpGutter(ctx.pageCount)
    : config.geometry.gutter;
  const m = pageMargins(config.trim, gutter, t.mirrored);
  const folio = config.pageNumbers
    ? `@bottom-center { content: counter(page); font-size: 9pt; }`
    : "";
  const rules: string[] = [
    `@page { size: ${trimToPage(config.trim)}; margin: ${inches(m.top)} ${inches(m.outer)} ${inches(m.bottom)} ${inches(m.inner)}; ${folio} }`,
  ];
  // book-wide head lives on the base page rule; chapter mode leaves it to the
  // chN named pages so front matter and the TOC print head-free
  if (config.runningHead && config.runningHeadMode === "book") {
    rules.push(`@page { @top-center { content: "${cssStr(ctx.title)}"; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; } }`);
  }
  if (t.mirrored) {
    rules.push(
      `@page :left { margin-left: ${inches(m.outer)}; margin-right: ${inches(m.inner)}; }`,
      `@page :right { margin-left: ${inches(m.inner)}; margin-right: ${inches(m.outer)}; }`,
    );
  }
  rules.push(`.print-book { font-family: ${config.font}; font-size: ${t.bodyPt}pt; line-height: ${t.leading / t.bodyPt}; }`);
  rules.push(
    `.print-book p { margin: 0; text-align: ${t.justify ? "justify" : "left"}; widows: 2; orphans: 2; }`,
    `.print-book p + p { text-indent: ${t.indent}em; }`,
    `.print-book blockquote + p, .print-book ul + p, .print-book ol + p { text-indent: ${t.indent}em; }`,
    `.print-book h1 + p, .print-book h2 + p, .print-book h3 + p, .print-book .chapter-note + p { text-indent: 0; }`,
  );
  if (t.hyphens) rules.push(`.print-book p { hyphens: auto; -webkit-hyphens: auto; }`);
  const opener = config.opener ?? { sink: 0.18, suppressHead: true, suppressFolio: true };
  // running head by chapter: a named page per chapter, tied to the flat
  // 1-based chapter index so numbering stays continuous across parts
  if (config.runningHead && config.runningHeadMode === "chapter") {
    ctx.chapters.forEach((ch, i) => {
      rules.push(
        `@page ch${i + 1} { @top-center { content: "${cssStr(ch.heading)}"; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; } }`,
        `.print-book .chapter[data-ch="${i + 1}"] { page: ch${i + 1}; }`,
      );
      if (opener.suppressHead || opener.suppressFolio) {
        const head = opener.suppressHead ? "@top-center { content: none; }" : "";
        const foot = opener.suppressFolio ? "@bottom-center { content: none; }" : "";
        rules.push(`@page ch${i + 1}:first { ${head} ${foot} }`);
      }
    });
  }
  rules.push(
    `.print-book .chapter { break-before: page; padding-top: ${Math.round(opener.sink * 100)}%; }`,
    `.print-book .chapter h2 { margin: 0 0 1.2em; text-align: center; }`,
    `.print-book .chapter h2 .ch-num { display: block; font-size: 0.8em; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.4em; }`,
  );
  if (config.dropCaps) {
    rules.push(`.print-book .chapter > p:first-of-type::first-letter { font-size: 2.6em; float: left; line-height: 0.85; padding-right: 0.08em; }`);
  }
  return rules.join("\n");
}
