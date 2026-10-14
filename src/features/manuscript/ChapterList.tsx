import type { Chapter } from "../../domain/types";

/** `content.trim().split(/\s+/).filter(Boolean)` — the plan's wordcount rule. */
export const countWords = (content: string): number =>
  content.trim().split(/\s+/).filter(Boolean).length;

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
        <p className="book-empty-copy">Adicione o primeiro capítulo.</p>
      ) : (
        <ul className="book-ch-rows" aria-label="Capítulos">
          {chapters.map((chapter, index) => {
            const words = countWords(chapter.content);
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  className="book-ch-move"
                  aria-label="Reordenar capítulo acima"
                  disabled={index === 0}
                  onClick={() => onMove(chapter.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="book-ch-move"
                  aria-label="Reordenar capítulo abaixo"
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
                  <span className="book-ch-words">{words} palavras</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="btn-primary book-ch-new" onClick={onCreate}>
        Novo capítulo
      </button>
    </aside>
  );
}
