import type { Chapter } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { countWords, formatWords } from "./words";

export interface ChapterListProps {
  chapters: Chapter[];
  selectedId: string | null;
  onSelect(id: string): void;
  onMove(id: string, dir: -1 | 1): void;
  onCreate(): void;
}

export function ChapterList({ chapters, selectedId, onSelect, onMove, onCreate }: ChapterListProps) {
  return (
    <aside className="book-chapters">
      {chapters.length === 0 ? (
        <p className="book-empty-copy">Add the first chapter.</p>
      ) : (
        <ul className="book-ch-rows" aria-label="Chapters">
          {chapters.map((chapter, index) => {
            const words = countWords(chapter.content);
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  className="book-ch-move"
                  aria-label="Move chapter up"
                  disabled={index === 0}
                  onClick={() => onMove(chapter.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="book-ch-move"
                  aria-label="Move chapter down"
                  disabled={index === chapters.length - 1}
                  onClick={() => onMove(chapter.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={"book-ch-row" + (chapter.id === selectedId ? " active" : "")}
                  onClick={() => onSelect(chapter.id)}
                >
                  <span className="book-ch-heading">{chapter.heading}</span>
                  <span className="book-ch-words">{formatWords(words)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="btn-primary book-ch-new" onClick={onCreate}>
        New chapter
      </button>
    </aside>
  );
}

export function DocxReplaceButton({ chapterId }: { chapterId: string }) {
  const pushToast = useScriptorium((s) => s.pushToast);
  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { importDocxToHtml } = await import("./docx");
      const html = await importDocxToHtml(file);
      useScriptorium.getState().updateChapter(chapterId, { content: html });
      pushToast("success", "Chapter replaced by the .docx.");
    } catch {
      pushToast("error", "Import failed. Check that all files are valid .docx.");
    }
  };
  return (
    <label className="book-mode book-docx-btn" title="Replace this chapter's body from a .docx">
      Replace with .docx
      <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => void onChange(e)} />
    </label>
  );
}
