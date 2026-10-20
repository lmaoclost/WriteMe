import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Chapter as EpubChapter } from "epub-gen-memory";
import type { Manuscript } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { defaultBindery } from "../../data/schema";
import {
  aboutAuthorSection, bookSections, chapterInner, chapterNumber, colophonSection,
  copyrightPage, dedicationSection, epigraphSection, glossaryFor, halfTitleSection, partInner,
} from "./buildBook";
import { estimatePageCount } from "./bindery";
import { buildEpubCss } from "./epubCss";
import { downloadBlob } from "../../data/download";
import { i18n, normalizeLanguage } from "../../i18n";

/** Lowercase, accent-folded, runs of non-alnum become one dash, trimmed; empty → the localized fallback. */
function slugify(text: string): string {
  return (
    text
      .toLocaleLowerCase(i18n.language)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || i18n.t("export.slugFallback")
  );
}

export interface ExportButtonsProps {
  manuscript: Manuscript;
}

/** EPUB (lazy epub-gen-memory → blob download) + Word (docx) buttons for the
 *  Publishing header. PDF lives in "Print preview" (bindery-styled print pass). */
export function ExportButtons({ manuscript }: ExportButtonsProps) {
  const { t } = useTranslation();
  const pushToast = useScriptorium((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  const disabled = manuscript.chapters.length === 0 || busy;
  const title = manuscript.chapters.length === 0 ? t("bindery.addChaptersFirst") : undefined;

  const exportDocx = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const [{ Document, Packer }, { buildDocxChildren, docxPageSetup, docxStyles }] = await Promise.all([
        import("docx"),
        import("./docx"),
      ]);
      const config = { ...defaultBindery(), ...(manuscript.bindery ?? {}) } as NonNullable<Manuscript["bindery"]>;
      const blob = await Packer.toBlob(new Document({
        styles: docxStyles(config),
        // Word hyphenates at document level, mirroring typography.hyphens
        ...(config.typography?.hyphens ? { hyphenation: { autoHyphenation: true } } : {}),
        sections: [{
          properties: docxPageSetup(config, { pageCount: estimatePageCount(manuscript) }),
          children: buildDocxChildren(manuscript),
        }],
      }));
      downloadBlob(blob, `${slugify(manuscript.title)}.docx`);
      useScriptorium.getState().pushToast("success", t("export.docxSuccess"));
    } catch {
      useScriptorium.getState().pushToast("error", t("export.docxError"));
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
      if (fm.copyright) pushFront(copyrightPage(manuscript, bindery), t("book.copyright"), true);
      pushFront(dedicationSection(bindery), t("book.dedication"));
      pushFront(epigraphSection(bindery), t("book.epigraph"));
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
            content: `<section class="chapter" epub:type="chapter">${chapterInner(bindery, chapter, chapterNo)}</section>`,
          });
        });
      });
      if (bindery.backMatter?.glossary ?? bindery.glossary ?? false) {
        const glossary = glossaryFor(manuscript);
        if (glossary) entries.push({ title: t("book.glossary"), content: glossary });
      }
      const about = aboutAuthorSection(bindery);
      if (about) entries.push({ title: t("book.aboutAuthor"), content: about });
      const colophon = colophonSection(bindery);
      if (colophon) entries.push({ title: t("book.colophon"), content: colophon });

      const defaults = optionsDefaults(3);
      const options = {
        ...defaults,
        title: manuscript.title,
        author: manuscript.author || undefined,
        lang: normalizeLanguage(i18n.language),
        tocTitle: t("book.contents"),
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
      downloadBlob(blob, `${slugify(manuscript.title)}.epub`);
      pushToast("success", t("export.epubSuccess"));
    } catch (error) {
      console.error("EPUB export failed:", error);
      pushToast("error", t("export.epubError"));
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
        {t("export.epub")}
      </button>
      <button
        type="button"
        className="bg-ink text-parchment-dim border border-line rounded-sm px-2.5 py-1.5 text-[13px] transition-colors hover:text-parchment hover:border-gold-dim disabled:opacity-40 disabled:cursor-default enabled:cursor-pointer"
        disabled={disabled}
        title={title}
        onClick={() => void exportDocx()}
      >
        {t("export.docx")}
      </button>
    </>
  );
}
