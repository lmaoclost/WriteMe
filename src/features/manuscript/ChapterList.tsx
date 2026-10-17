import type { Chapter } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { countWords, formatWords } from "./words";
import { Button } from "../../ui/Button";

export interface ChapterListProps {
  chapters: Chapter[];
  selectedId: string | null;
  onSelect(id: string): void;
  onMove(id: string, dir: -1 | 1): void;
  onCreate(): void;
}

export function ChapterList({ chapters, selectedId, onSelect, onMove, onCreate }: ChapterListProps) {
  return (
    <aside className="book-chapters flex flex-col gap-2.5 min-h-0 p-3 bg-night border-r border-line max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:border-line">
      {chapters.length === 0 ? (
        <p className="mx-2 my-2 text-parchment-dim text-[13px]">Add the first chapter.</p>
      ) : (
        <ul className="book-ch-rows list-none m-0 p-0.5 flex flex-col gap-1 overflow-y-auto flex-1 min-h-0" aria-label="Chapters">
          {chapters.map((chapter, index) => {
            const words = countWords(chapter.content);
            return (
              <li key={chapter.id}>
                <button
                  type="button"
                  className="book-ch-move w-[26px] bg-none border border-line rounded-lg text-parchment-dim text-xs leading-none hover:border-gold-dim hover:text-gold disabled:opacity-35 disabled:cursor-default"
                  aria-label="Move chapter up"
                  disabled={index === 0}
                  onClick={() => onMove(chapter.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="book-ch-move w-[26px] bg-none border border-line rounded-lg text-parchment-dim text-xs leading-none hover:border-gold-dim hover:text-gold disabled:opacity-35 disabled:cursor-default"
                  aria-label="Move chapter down"
                  disabled={index === chapters.length - 1}
                  onClick={() => onMove(chapter.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={"book-ch-row flex-1 min-w-0 text-left bg-none border-0 border-l-2 border-transparent rounded-lg text-parchment px-2 py-1.5 text-sm" + (chapter.id === selectedId ? " active border-l-gold bg-night-2" : "") + " hover:bg-night-2"}
                  onClick={() => onSelect(chapter.id)}
                >
                  <span className="book-ch-heading overflow-hidden text-ellipsis whitespace-nowrap">{chapter.heading}</span>
                  <span className="text-[11px] text-slate">{formatWords(words)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button className="book-ch-new self-start" onClick={onCreate}>
        New chapter
      </Button>
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
    <label className="book-mode book-docx-btn bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] hover:border-gold-dim cursor-pointer" title="Replace this chapter's body from a .docx">
      Replace with .docx
      <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => void onChange(e)} />
    </label>
  );
}
