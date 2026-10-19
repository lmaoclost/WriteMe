/** Generated print stylesheet — page geometry, mirrored margins, folio,
 *  chapter openers (own page when a head or folio is suppressed, sink),
 *  running heads (book-wide head on the base page, or per-chapter named
 *  pages), part divider pages (same sink, head/folio suppressed by the
 *  partpage named page) and scene ornaments (glyph, blank, or rule by
 *  config). Ordered geometry first, then typography; structure rules land
 *  here too. */

import type { BinderyConfig, Part, SceneOrnament } from "../../domain/types";
import { inches, kdpGutter, pageMargins, trimToPage } from "./bindery";

export interface BookCtx {
  title: string;
  chapters: { heading: string; partId?: string }[];
  parts: Part[];
  pageCount: number;
}

/** CSS string literal: escape backslashes and quotes for content: "...". */
const cssStr = (text: string) => text.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const ORNAMENT_GLYPHS: Record<SceneOrnament, string> = {
  blank: "", asterisks: "* * *", asterism: "⁂", fleuron: "❦", rule: "",
};

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
  // book-wide head lives on the base page rule; anything that is not chapter
  // mode (including an undefined one) prints it. Chapter mode leaves the base
  // rule head-free so front matter and the TOC print without a head
  if (config.runningHead && config.runningHeadMode !== "chapter") {
    rules.push(`@page { @top-center { content: "${cssStr(ctx.title)}"; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; } }`);
  }
  if (t.mirrored) {
    rules.push(
      `@page :left { margin-left: ${inches(m.outer)}; margin-right: ${inches(m.inner)}; }`,
      `@page :right { margin-left: ${inches(m.inner)}; margin-right: ${inches(m.outer)}; }`,
    );
  }
  // display pages (half title, title, copyright, dedication, epigraph) carry
  // no folio and no running head; other front matter (the TOC) keeps the
  // roman folio when roman numerals are on
  rules.push(
    `@page display { @bottom-center { content: none; } @top-center { content: none; } }`,
    `.print-book .front-matter.display { page: display; }`,
  );
  if (config.frontMatter?.romanNumerals && config.pageNumbers) {
    rules.push(
      `@page frontmatter { @bottom-center { content: counter(page, lower-roman); } }`,
      `.print-book .front-matter { page: frontmatter; }`,
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
  const sinkPct = Math.round(opener.sink * 100);
  // running head by chapter: a named page per chapter, tied to the flat
  // 1-based chapter index so numbering stays continuous across parts
  const chapterPages = config.runningHead && config.runningHeadMode === "chapter";
  if (chapterPages) {
    ctx.chapters.forEach((ch, i) => {
      rules.push(
        `@page ch${i + 1} { @top-center { content: "${cssStr(ch.heading)}"; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; } }`,
        `.print-book .chapter[data-ch="${i + 1}"] { page: ch${i + 1}; }`,
      );
    });
  }
  // the opener page: Chromium ignores `@page <name>:first`, so the only way
  // to keep a head or a folio off the opening page is to give the opener its
  // own page (suppressing exactly the boxes the config asks for) and start
  // the text on the next one; suppression off, opener and text share a page
  for (let i = 0; i < ctx.chapters.length; i += 1) {
    if (opener.suppressHead || opener.suppressFolio) {
      const suppress = [
        opener.suppressHead ? "@top-center { content: none; }" : "",
        opener.suppressFolio ? "@bottom-center { content: none; }" : "",
      ].filter(Boolean).join(" ");
      rules.push(
        `@page opener${i + 1} { ${suppress} }`,
        `.print-book .chapter-opener[data-ch="${i + 1}"] { page: opener${i + 1}; break-before: page; padding-top: ${sinkPct}%; }`,
      );
    } else {
      // the opener must carry the body's named page: a page change between
      // the pair forces a break no `avoid` can cancel, splitting opener from
      // text even with both suppressions off
      if (chapterPages) {
        rules.push(`.print-book .chapter-opener[data-ch="${i + 1}"] { page: ch${i + 1}; }`);
      }
      rules.push(`.print-book .chapter-opener[data-ch="${i + 1}"] + .chapter { break-before: avoid; }`);
    }
  }
  // the opener section carries the chapter start (its page break and sink);
  // the body section keeps the generic break that lifts the text off the
  // opener page, cancelled by the sibling rule above when they share a page
  rules.push(
    `.print-book .chapter-opener { break-before: page; padding-top: ${sinkPct}%; }`,
    `.print-book .chapter { break-before: page; }`,
    `.print-book .chapter-opener h2 { margin: 0 0 1.2em; text-align: center; }`,
    `.print-book .chapter-opener h2 .ch-num { display: block; font-size: 0.8em; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.4em; }`,
  );
  // scene break: a punctuation marker prints as the configured ornament (the
  // glyph rides on ::before; blank keeps the air, rule draws a short rule);
  // an authored line (.scene-marker.text) keeps its own words, same shape
  const ornament = config.sceneOrnament ?? "asterism";
  rules.push(`.print-book .scene-marker { text-align: center; letter-spacing: 0.3em; margin: 1.5em auto; }`);
  if (ornament === "blank") {
    rules.push(`.print-book .scene-marker.ornament { height: 1.5em; }`);
  } else if (ornament === "rule") {
    rules.push(`.print-book .scene-marker.ornament { border-top: 1px solid currentColor; width: 4em; }`);
  } else {
    rules.push(`.print-book .scene-marker.ornament::before { content: "${cssStr(ORNAMENT_GLYPHS[ornament])}"; }`);
  }
  // a part divider is its own page: same sink knob as chapter openers, and a
  // named page so the book-mode head and the folio stay off it
  if (ctx.parts.length > 0) {
    rules.push(
      `@page partpage { @bottom-center { content: none; } @top-center { content: none; } }`,
      `.print-book .part-divider { page: partpage; }`,
      `.print-book .part-divider { break-before: page; padding-top: ${Math.round(opener.sink * 100)}%; text-align: center; }`,
      `.print-book .part-num { font-size: 0.8em; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.4em; }`,
      `.print-book .part-title { font-size: 1.6em; margin: 0 0 1.2em; }`,
      `.print-book .part-epigraph { font-style: italic; max-width: 60%; margin: 0 auto; }`,
    );
  }
  if (config.dropCaps) {
    rules.push(`.print-book .chapter > p:not(.empty):first-of-type::first-letter { font-size: 2.6em; float: left; line-height: 0.85; padding-right: 0.08em; }`);
  }
  return rules.join("\n");
}
