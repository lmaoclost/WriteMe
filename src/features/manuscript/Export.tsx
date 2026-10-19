import { useState } from "react";
import type { Chapter as EpubChapter } from "epub-gen-memory";
import type { Manuscript } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { defaultBindery } from "../../data/schema";
import {
  aboutAuthorSection, bookSections, chapterInner, chapterNumber, colophonSection,
  copyrightPage, dedicationSection, epigraphSection, glossaryFor, halfTitleSection, partInner,
} from "./buildBook";
import { buildEpubCss } from "./epubCss";

/** Lowercase, accent-folded, runs of non-alnum become one dash, trimmed; empty → "livro". */
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "livro"
  );
}

export interface ExportButtonsProps {
  manuscript: Manuscript;
}

/** EPUB (lazy epub-gen-memory → blob download) + Word (docx) buttons for the
 *  Publishing header. PDF lives in "Print preview" (bindery-styled print pass). */
export function ExportButtons({ manuscript }: ExportButtonsProps) {
  const pushToast = useScriptorium((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  const disabled = manuscript.chapters.length === 0 || busy;
  const title = manuscript.chapters.length === 0 ? "Add chapters first" : undefined;

  const exportDocx = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const [{ Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType }, { htmlToBlocks }] = await Promise.all([
        import("docx"),
        import("./docx"),
      ]);
      const chapters = [...manuscript.chapters].sort((a, b) => a.order - b.order);
      const children = [
        new Paragraph({ children: [new TextRun({ text: manuscript.title, bold: true, size: 48 })], alignment: AlignmentType.CENTER }),
        ...(manuscript.author ? [new Paragraph({ children: [new TextRun({ text: manuscript.author, italics: true, size: 24 })], alignment: AlignmentType.CENTER })] : []),
      ];
      for (const ch of chapters) {
        children.push(new Paragraph({ children: [new TextRun({ text: ch.heading, bold: true })], heading: HeadingLevel.HEADING_2 }));
        if (ch.noteTop) children.push(new Paragraph({ children: [new TextRun({ text: ch.noteTop, italics: true, color: "7A7A99" })] }));
        const blocks = htmlToBlocks(ch.content || "");
        if (!blocks.length) children.push(new Paragraph({ children: [new TextRun({ text: "No content yet.", italics: true })] }));
        for (const block of blocks) {
          if (block.kind === "li") {
            children.push(new Paragraph({ children: [new TextRun({ text: block.text })], bullet: { level: 0 } }));
          } else if (block.kind === "quote") {
            children.push(new Paragraph({ children: [new TextRun({ text: block.text, italics: true })], indent: { left: 360 } }));
          } else if (block.kind === "h1" || block.kind === "h2" || block.kind === "h3") {
            children.push(new Paragraph({ children: [new TextRun({ text: block.text, bold: true })], heading: block.kind === "h1" ? HeadingLevel.HEADING_2 : block.kind === "h2" ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4 }));
          } else {
            children.push(new Paragraph({ children: [new TextRun({ text: block.text })] }));
          }
        }
        if (ch.endMarker) children.push(new Paragraph({ children: [new TextRun({ text: ch.endMarker, smallCaps: true })], alignment: AlignmentType.CENTER }));
      }
      const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slugify(manuscript.title)}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
      useScriptorium.getState().pushToast("success", "Word gerado.");
    } catch {
      useScriptorium.getState().pushToast("error", "Falha ao gerar o Word.");
    } finally {
      setBusy(false);
    }
  };

  const exportEpub = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const { EPub, optionsDefaults } = await import("epub-gen-memory");
      const state = useScriptorium.getState();
      const project = state.projects.find((p) => p.id === manuscript.projectId);
      const cover = project?.coverImageKey ? state.images[project.coverImageKey] : undefined;
      const bindery = { ...defaultBindery(), ...(manuscript.bindery ?? {}) } as NonNullable<Manuscript["bindery"]>;
      const numbering = bindery.numberingStyle ?? "arabic";
      const fm = bindery.frontMatter ?? { halfTitle: false, copyright: false, romanNumerals: false };
      // Spine plan: front matter before the TOC (all beforeToc entries first,
      // or the package warns), the bookSections run with parts as their own
      // entries, back matter last. Titles carry the print-style number so the
      // package must not number them again in the TOC.
      const entries: EpubChapter[] = [];
      const pushFront = (html: string, title: string, excludeFromToc = false) => {
        if (html) entries.push({ title, content: html, beforeToc: true, excludeFromToc });
      };
      if (fm.halfTitle) pushFront(halfTitleSection(manuscript), manuscript.title, true);
      if (fm.copyright) pushFront(copyrightPage(manuscript, bindery), "Copyright", true);
      pushFront(dedicationSection(bindery), "Dedication");
      pushFront(epigraphSection(bindery), "Epigraph");
      let chapterNo = 0;
      let partNo = 0;
      bookSections(manuscript).forEach(({ part, chapters }) => {
        if (part) {
          partNo += 1;
          const num = chapterNumber(numbering, partNo);
          entries.push({
            title: num ? `${num} ${part.title}` : part.title,
            content: `<section class="part-divider" epub:type="part">${partInner(part, num)}</section>`,
          });
        }
        chapters.forEach((chapter) => {
          chapterNo += 1;
          const num = chapterNumber(numbering, chapterNo);
          entries.push({
            title: num ? `${num} ${chapter.heading}` : chapter.heading,
            content: `<section class="chapter" epub:type="chapter" data-ch="${chapterNo}">${chapterInner(bindery, chapter, chapterNo)}</section>`,
          });
        });
      });
      if (bindery.backMatter?.glossary ?? bindery.glossary ?? false) {
        const glossary = glossaryFor(manuscript);
        if (glossary) entries.push({ title: "Glossary", content: glossary });
      }
      const about = aboutAuthorSection(bindery);
      if (about) entries.push({ title: "About the author", content: about });
      const colophon = colophonSection(bindery);
      if (colophon) entries.push({ title: "Colophon", content: colophon });

      const defaults = optionsDefaults(3);
      const options = {
        ...defaults,
        title: manuscript.title,
        author: manuscript.author || undefined,
        lang: "pt",
        tocTitle: "Contents",
        numberChaptersInTOC: false,
        prependChapterTitles: false,
        // append, never replace: the package default carries the template reset
        css: `${defaults.css}\n${buildEpubCss(bindery)}`,
        ...(cover ? { cover } : {}),
      };
      // genEpub() itself runs render(); real export is the EPub class (not the default fn).
      const epub = new EPub(options, entries);
      const data = await epub.genEpub();
      const blob = new Blob([data as BlobPart], { type: "application/epub+zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slugify(manuscript.title)}.epub`;
      anchor.click();
      URL.revokeObjectURL(url);
      pushToast("success", "EPUB gerado.");
    } catch (error) {
      console.error("EPUB export failed:", error);
      pushToast("error", "Falha ao gerar o EPUB.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="bg-ink text-parchment-dim border border-line rounded-sm px-2.5 py-1.5 text-[13px] transition-colors hover:text-parchment hover:border-gold-dim disabled:opacity-40 disabled:cursor-default enabled:cursor-pointer"
        disabled={disabled}
        aria-busy={busy ? "true" : undefined}
        title={title}
        onClick={() => void exportEpub()}
      >
        Exportar EPUB
      </button>
      <button
        type="button"
        className="bg-ink text-parchment-dim border border-line rounded-sm px-2.5 py-1.5 text-[13px] transition-colors hover:text-parchment hover:border-gold-dim disabled:opacity-40 disabled:cursor-default enabled:cursor-pointer"
        disabled={disabled}
        title={title}
        onClick={() => void exportDocx()}
      >
        Exportar Word
      </button>
    </>
  );
}
