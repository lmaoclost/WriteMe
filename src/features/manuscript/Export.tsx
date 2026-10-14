import type { Manuscript } from "../../domain/types";

export interface ExportToolsProps {
  manuscript: Manuscript;
}

/** Task 2 shell: the row renders; MS3 wires the EPUB/PDF handlers. */
export function ExportTools({ manuscript }: ExportToolsProps) {
  const disabled = manuscript.chapters.length === 0;
  const title = disabled ? "Adicione capítulos primeiro" : undefined;
  return (
    <div className="book-export">
      <button type="button" className="book-export-btn" disabled={disabled} title={title}>
        Exportar EPUB
      </button>
      <button type="button" className="book-export-btn" disabled={disabled} title={title}>
        Exportar PDF
      </button>
    </div>
  );
}
