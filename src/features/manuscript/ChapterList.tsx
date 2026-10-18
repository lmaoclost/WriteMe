import { memo, useMemo, useRef } from "react";
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

/** Word counts cached per chapter id: any chapter commit (debounced while
 *  typing) recreates the chapters array and would otherwise re-run
 *  DOMParser + regex over every chapter body on the next render. */
interface WordCacheEntry { content: string; words: number }

function buildWordCounts(chapters: Chapter[], cache: Map<string, WordCacheEntry>): Map<string, WordCacheEntry> {
  const next = new Map<string, WordCacheEntry>();
  for (const c of chapters) {
    const prev = cache.get(c.id);
    if (prev && prev.content === c.content) {
      next.set(c.id, prev);
    } else {
      next.set(c.id, { content: c.content, words: countWords(c.content) });
    }
  }
  return next;
}

const ChapterRow = memo(function ChapterRow({ chapter, index, total, selected, words, onSelect, onMove }: {
  chapter: Chapter;
  index: number;
  total: number;
  selected: boolean;
  words: number;
  onSelect(id: string): void;
  onMove(id: string, dir: -1 | 1): void;
}) {
  return (
    <li className="flex items-stretch gap-1">
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
        disabled={index === total - 1}
        onClick={() => onMove(chapter.id, 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className={"book-ch-row flex-1 min-w-0 flex flex-col gap-0.5 text-left bg-none border-0 border-l-2 border-transparent rounded-lg text-parchment px-2 py-1.5 text-sm" + (selected ? " active border-l-gold bg-night-2" : "") + " hover:bg-night-2"}
        onClick={() => onSelect(chapter.id)}
      >
        <span className="book-ch-heading overflow-hidden text-ellipsis whitespace-nowrap">{chapter.heading}</span>
        <span className="text-[11px] text-slate">{formatWords(words)}</span>
      </button>
    </li>
  );
});

export function ChapterList({ chapters, selectedId, onSelect, onMove, onCreate }: ChapterListProps) {
  const wordsRef = useRef(new Map<string, WordCacheEntry>());
  const wordsByChapter = useMemo(() => buildWordCounts(chapters, wordsRef.current), [chapters]);

  return (
    <aside className="book-chapters flex flex-col gap-2.5 min-h-0 p-3 bg-night border-r border-line max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:border-line">
      {chapters.length === 0 ? (
        <p className="mx-2 my-2 text-parchment-dim text-[13px]">Add the first chapter.</p>
      ) : (
        <ul className="book-ch-rows list-none m-0 p-0.5 flex flex-col gap-1 overflow-y-auto flex-1 min-h-0" aria-label="Chapters">
          {chapters.map((chapter, index) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              index={index}
              total={chapters.length}
              selected={chapter.id === selectedId}
              words={wordsByChapter.get(chapter.id)?.words ?? 0}
              onSelect={onSelect}
              onMove={onMove}
            />
          ))}
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