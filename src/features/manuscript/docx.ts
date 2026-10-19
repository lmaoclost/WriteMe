/** .docx import/export for chapters. */

import { AlignmentType, HeadingLevel, LineRuleType, Paragraph, TextRun, convertInchesToTwip } from "docx";
import type { IParagraphStyleOptions, IStylesOptions } from "docx";
import type { BinderyConfig, Manuscript, SceneOrnament } from "../../domain/types";
import { defaultBindery } from "../../data/schema";
import { bookSections, chapterNumber } from "./buildBook";
import { kdpGutter, pageMargins } from "./bindery";
import { renderMarkdown } from "../entries/markdown";
import { i18n } from "../../i18n";

/** Block-level conversion of sanitized chapter HTML into flat text blocks. */
export interface DocxBlock { kind: "p" | "h1" | "h2" | "h3" | "quote" | "li"; text: string }

export function htmlToBlocks(html: string): DocxBlock[] {
  const doc = new DOMParser().parseFromString(html ?? "", "text/html");
  const out: DocxBlock[] = [];
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "script" || tag === "style") continue;
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (tag === "ul" || tag === "ol") {
        for (const li of Array.from(el.children)) {
          out.push({ kind: "li", text: (li.textContent ?? "").trim() });
        }
        continue;
      }
      if (["p", "h1", "h2", "h3", "blockquote"].includes(tag) && text) {
        out.push({ kind: (tag === "blockquote" ? "quote" : tag) as "p" | "h1" | "h2" | "h3" | "quote", text });
        continue;
      }
      if (text) { out.push({ kind: "p", text }); continue; }
      walk(el);
    }
  };
  walk(doc.body);
  return out;
}

/** Import: mammoth converts .docx to chapter HTML (markdown-agnostic). */
export async function importDocxToHtml(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = await fileToArrayBuffer(file);
  const result = await (mammoth.default ?? mammoth).convertToHtml({ arrayBuffer: buffer });
  if (!result?.value) throw new Error("no content");
  return result.value;
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  // jsdom lacks Blob.arrayBuffer; FileReader exists everywhere.
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("falha ao ler o arquivo"));
    reader.readAsArrayBuffer(file);
  });
}

const TWIPS_PER_POINT = 20;

const ORNAMENT_GLYPHS: Record<SceneOrnament, string> = {
  blank: "", asterisks: "* * *", asterism: "⁂", fleuron: "❦", rule: "",
};

/** Print typography in Word units: indent and line spacing in twips (20 per
 *  point), run size in half-points, alignment from `typography.justify`, and
 *  the first family of the CSS stack as the font name Word can resolve. */
function typeMetrics(config: BinderyConfig) {
  const bodyPt = config.typography?.bodyPt ?? 11;
  const leading = config.typography?.leading ?? 14.5;
  const justify = config.typography?.justify ?? true;
  const font = (config.font.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  return {
    bodyPt,
    size: bodyPt * 2,
    font: font || undefined,
    indent: Math.round((config.typography?.indent ?? 1) * bodyPt * TWIPS_PER_POINT),
    // w:line under lineRule auto counts 240ths of a line (240 = single)
    line: Math.round((leading / bodyPt) * 240),
    alignment: justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
  };
}

/** One Word section's page box, trim size and margins in twips. */
export interface DocxPageSetup {
  page: {
    size: { width: number; height: number };
    margin: { top: number; right: number; bottom: number; left: number };
  };
}

export interface DocxPageContext {
  /** Estimated print page count — selects the KDP gutter when none is set. */
  pageCount: number;
  /** Gutter override in inches; beats the configured and KDP values. */
  gutter?: number;
}

/** Print page geometry for the Word section: trim in twips, margins from
 *  `pageMargins`. Gutter precedence: explicit ctx → numeric
 *  `geometry.gutter` → KDP floor for the page count. `docx` exposes no
 *  mirrored-margins setting (Word's w:mirrorMargins), so the inner margin
 *  goes left and the outer right on every page — print's @page :right box. */
export function docxPageSetup(config: BinderyConfig, ctx: DocxPageContext): DocxPageSetup {
  const gutter = ctx.gutter
    ?? (typeof config.geometry?.gutter === "number" ? config.geometry.gutter : kdpGutter(ctx.pageCount));
  const mirrored = config.geometry?.mirrored ?? true;
  const m = pageMargins(config.trim, gutter, mirrored);
  const [width, height] = config.trim.split("x").map(Number);
  return {
    page: {
      size: { width: convertInchesToTwip(width), height: convertInchesToTwip(height) },
      margin: {
        top: convertInchesToTwip(m.top),
        bottom: convertInchesToTwip(m.bottom),
        left: convertInchesToTwip(m.inner),
        right: convertInchesToTwip(m.outer),
      },
    },
  };
}

/** Document styles: BookBody carries the print body voice (indent,
 *  justification, leading, size) and BookHeading the centered titles; the
 *  document defaults give every unstyled run (bullets, quotes, notes) the
 *  book's font and size, so nothing falls back to Word's theme. */
export function docxStyles(config: BinderyConfig): IStylesOptions {
  const t = typeMetrics(config);
  const body: IParagraphStyleOptions = {
    id: "BookBody",
    name: "Book body",
    run: { font: t.font, size: t.size },
    paragraph: {
      alignment: t.alignment,
      indent: { firstLine: t.indent },
      spacing: { before: 0, after: 0, line: t.line, lineRule: LineRuleType.AUTO },
    },
  };
  const heading: IParagraphStyleOptions = {
    id: "BookHeading",
    name: "Book heading",
    next: "BookBody",
    run: { font: t.font, size: t.size, bold: true },
    paragraph: {
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: Math.round(1.2 * t.bodyPt * TWIPS_PER_POINT) },
    },
  };
  return {
    default: { document: { run: { font: t.font, size: t.size } } },
    paragraphStyles: [body, heading],
  };
}

/** Scene break: a punctuation marker becomes the configured ornament
 *  centered; blank keeps an empty line (print keeps the air) and the rule
 *  draws a line of em dashes — a docx paragraph border spans the full
 *  measure, not print's short 4em rule. */
function ornamentParagraph(config: BinderyConfig): Paragraph {
  const ornament = config.sceneOrnament ?? "asterism";
  const text = ornament === "rule" ? "—".repeat(4) : ORNAMENT_GLYPHS[ornament];
  return new Paragraph({ children: text ? [new TextRun({ text })] : [], alignment: AlignmentType.CENTER });
}

/** The whole book as Word paragraphs: the title page block, then the spine
 *  from `bookSections` — each part divider on its own page (print's number
 *  rule, title, epigraph) and each chapter on its own page with its print
 *  number, top note, markdown body, scene marker and end note. Front matter,
 *  back matter and drop caps stay out of the Word pass (the copy would be a
 *  third implementation of each). */
export function buildDocxChildren(manuscript: Manuscript): Paragraph[] {
  const config = { ...defaultBindery(), ...(manuscript.bindery ?? {}) } as NonNullable<Manuscript["bindery"]>;
  const t = typeMetrics(config);
  const children: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: manuscript.title, bold: true, size: 48 })], alignment: AlignmentType.CENTER }),
    ...(manuscript.author
      ? [new Paragraph({ children: [new TextRun({ text: manuscript.author, italics: true, size: 24 })], alignment: AlignmentType.CENTER })]
      : []),
  ];
  const numbering = config.numberingStyle ?? "arabic";
  /** The print number line above a title: 0.8em, tracked, uppercase. */
  const numberRun = (label: string) => new TextRun({
    text: label,
    size: Math.round(0.8 * t.bodyPt) * 2,
    characterSpacing: Math.round(0.2 * t.bodyPt * TWIPS_PER_POINT),
    allCaps: true,
  });
  /** print's reset rule: the paragraph after a heading or top note opens flush. */
  let flush = false;
  let chapterNo = 0;
  let partNo = 0;

  bookSections(manuscript).forEach(({ part, chapters }) => {
    if (part) {
      partNo += 1;
      const num = chapterNumber(numbering, partNo);
      const title = new TextRun({ text: part.title, size: Math.round(1.6 * t.bodyPt) * 2, ...(num ? { break: 1 } : {}) });
      children.push(new Paragraph({
        pageBreakBefore: true,
        style: "BookHeading",
        alignment: AlignmentType.CENTER,
        children: [...(num ? [numberRun(num)] : []), title],
      }));
      flush = true;
      if (part.epigraph?.trim()) {
        for (const block of htmlToBlocks(renderMarkdown(part.epigraph.trim()))) {
          children.push(new Paragraph({ children: [new TextRun({ text: block.text, italics: true })], alignment: AlignmentType.CENTER }));
        }
      }
    }
    chapters.forEach((chapter) => {
      chapterNo += 1;
      const num = chapterNumber(numbering, chapterNo);
      children.push(new Paragraph({
        pageBreakBefore: true,
        style: "BookHeading",
        alignment: AlignmentType.CENTER,
        children: [...(num ? [numberRun(num)] : []), new TextRun({ text: chapter.heading, ...(num ? { break: 1 } : {}) })],
      }));
      flush = true;
      if (chapter.noteTop?.trim()) {
        children.push(new Paragraph({ children: [new TextRun({ text: chapter.noteTop.trim(), italics: true, color: "7A7A99" })] }));
        flush = true;
      }
      // chapter copy is markdown (or rich-editor HTML): the same
      // renderMarkdown → blocks pipeline print and EPUB run, so plain-text
      // markdown would otherwise drop out of the export entirely
      const blocks = htmlToBlocks(renderMarkdown(chapter.content || ""));
      if (!blocks.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: i18n.t("manuscript.noContent"), italics: true })] }));
      }
      for (const block of blocks) {
        if (block.kind === "li") {
          children.push(new Paragraph({ children: [new TextRun({ text: block.text })], bullet: { level: 0 } }));
          // only a heading or a note resets the flush paragraph: print's
          // `ul + p` and `blockquote + p` re-indent, so the flag dies here
          flush = false;
        } else if (block.kind === "quote") {
          children.push(new Paragraph({ children: [new TextRun({ text: block.text, italics: true })], indent: { left: 360 } }));
          flush = false;
        } else if (block.kind === "h1" || block.kind === "h2" || block.kind === "h3") {
          children.push(new Paragraph({
            children: [new TextRun({ text: block.text, bold: true })],
            heading: block.kind === "h1" ? HeadingLevel.HEADING_2 : block.kind === "h2" ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
          }));
          flush = true;
        } else {
          children.push(new Paragraph({
            style: "BookBody",
            alignment: t.alignment,
            indent: { firstLine: flush ? 0 : t.indent },
            children: [new TextRun({ text: block.text })],
          }));
          flush = false;
        }
      }
      if (chapter.endMarker?.trim()) {
        const marker = chapter.endMarker.trim();
        // a line carrying letters or digits is the writer's own words and
        // prints as written; punctuation becomes the scene ornament
        children.push(/[\p{L}\p{N}]/u.test(marker)
          ? new Paragraph({ children: [new TextRun({ text: marker, smallCaps: true })], alignment: AlignmentType.CENTER })
          : ornamentParagraph(config));
      }
      if (chapter.noteEnd?.trim()) {
        children.push(new Paragraph({ children: [new TextRun({ text: chapter.noteEnd.trim(), italics: true, color: "7A7A99" })] }));
      }
    });
  });
  return children;
}
