import { useEffect, useState } from "react";
import type { Manuscript } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { renderMarkdown } from "../entries/markdown";
import { buildBookHtml } from "./buildBook";

const PRINT_FALLBACK_MS = 500;

/** Lowercase, runs of non-alnum become one dash, trimmed; empty → "livro". */
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "livro"
  );
}

export interface ExportToolsProps {
  manuscript: Manuscript;
}

/** EPUB (lazy epub-gen-memory → blob download) + PDF (print-book + window.print). */
export function ExportTools({ manuscript }: ExportToolsProps) {
  const pushToast = useScriptorium((s) => s.pushToast);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  const disabled = manuscript.chapters.length === 0 || busy;
  const title = manuscript.chapters.length === 0 ? "Adicione capítulos primeiro" : undefined;

  // The print dialog must run AFTER the print-book markup reaches the DOM.
  useEffect(() => {
    if (!printing) return;
    let settled = false;
    const stop = () => {
      if (settled) return;
      settled = true;
      setPrinting(false);
    };
    const frame = window.requestAnimationFrame(() => window.print());
    window.addEventListener("afterprint", stop);
    const timeout = window.setTimeout(stop, PRINT_FALLBACK_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", stop);
      window.clearTimeout(timeout);
    };
  }, [printing]);

  const exportEpub = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const { EPub } = await import("epub-gen-memory");
      const state = useScriptorium.getState();
      const project = state.projects.find((p) => p.id === manuscript.projectId);
      const cover = project?.coverImageKey ? state.images[project.coverImageKey] : undefined;
      const options = {
        title: manuscript.title,
        author: manuscript.author || undefined,
        lang: "pt",
        ...(cover ? { cover } : {}),
      };
      const content = [...manuscript.chapters]
        .sort((a, b) => a.order - b.order)
        .map((chapter) => ({
          title: chapter.heading,
          content: renderMarkdown(chapter.content || ""),
        }));
      // genEpub() itself runs render(); real export is the EPub class (not the default fn).
      const epub = new EPub(options, content);
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

  const exportPdf = () => {
    if (printing || manuscript.chapters.length === 0) return;
    setPrinting(true);
  };

  return (
    <>
      <div className="book-export">
        <button
          type="button"
          className="book-export-btn"
          disabled={disabled}
          aria-busy={busy ? "true" : undefined}
          title={title}
          onClick={() => void exportEpub()}
        >
          Exportar EPUB
        </button>
        <button
          type="button"
          className="book-export-btn"
          disabled={manuscript.chapters.length === 0 || printing}
          title={title}
          onClick={exportPdf}
        >
          Exportar PDF
        </button>
      </div>
      {printing ? (
        <div
          className="print-book"
          data-testid="print-book"
          dangerouslySetInnerHTML={{ __html: buildBookHtml(manuscript) }}
        />
      ) : null}
    </>
  );
}
