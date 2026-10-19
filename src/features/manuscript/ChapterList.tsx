import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import type { Chapter, Part } from "../../domain/types";
import type { bookSections } from "./buildBook";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { countWords, formatWords } from "./words";
import { Button } from "../../ui/Button";

const CONFIRM_RESET_MS = 3000;

const MOVE_CLASS = "w-[26px] bg-none border border-line rounded-lg text-parchment-dim text-xs leading-none hover:border-gold-dim hover:text-gold disabled:opacity-35 disabled:cursor-default";

export interface ChapterListProps {
  /** Print-order plan from bookSections: ungrouped run first, then one
   *  block per part. Same grouping the book prints, so the panel and the
   *  exported book can never disagree. */
  sections: ReturnType<typeof bookSections>;
  selectedId: string | null;
  onSelect(id: string): void;
  onMove(id: string, dir: -1 | 1): void;
  onCreate(): void;
  onCreatePart(): void;
  onReorderPart(id: string, dir: -1 | 1): void;
  onRenamePart(id: string, title: string): void;
  onDeletePart(id: string): void;
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
        className={MOVE_CLASS}
        aria-label="Move chapter up"
        disabled={index === 0}
        onClick={() => onMove(chapter.id, -1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={MOVE_CLASS}
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

const PartRow = memo(function PartRow({ part, index, total, words, onReorder, onRename, onDelete }: {
  part: Part;
  index: number;
  total: number;
  words: number;
  onReorder(id: string, dir: -1 | 1): void;
  onRename(id: string, title: string): void;
  onDelete(id: string): void;
}) {
  const [editing, setEditing] = useState(false);
  const [armed, setArmed] = useState(false);
  const confirmTimerRef = useRef<number | undefined>(undefined);
  const draft = useDebouncedDraft(part.title, (v) => onRename(part.id, v));

  useEffect(() => () => window.clearTimeout(confirmTimerRef.current), []);

  const confirmOrDelete = () => {
    if (armed) {
      setArmed(false);
      window.clearTimeout(confirmTimerRef.current);
      onDelete(part.id);
      return;
    }
    setArmed(true);
    confirmTimerRef.current = window.setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
  };

  return (
    <li className="book-part-row flex items-stretch gap-1" role="presentation">
      <button
        type="button"
        className={MOVE_CLASS}
        aria-label="Move part up"
        disabled={index === 0}
        onClick={() => onReorder(part.id, -1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={MOVE_CLASS}
        aria-label="Move part down"
        disabled={index === total - 1}
        onClick={() => onReorder(part.id, 1)}
      >
        ↓
      </button>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5 px-2 py-1.5">
        {editing ? (
          <input
            type="text"
            autoFocus
            aria-label="Part title"
            className="w-full min-w-0 bg-ink border border-line rounded-lg px-1.5 py-0.5 text-xs text-parchment outline-none focus:border-gold"
            value={draft.draft}
            onChange={(e) => draft.setDraft(e.target.value)}
            onBlur={() => { draft.flush(); setEditing(false); }}
          />
        ) : (
          <span className="book-part-title overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold text-parchment-dim">{part.title}</span>
        )}
        <span data-testid={`part-words-${part.title}`} className="text-[11px] text-slate">{formatWords(words)}</span>
      </span>
      <button
        type="button"
        className="w-[26px] bg-none border border-line rounded-lg text-parchment-dim text-xs leading-none hover:border-gold-dim hover:text-gold"
        aria-label="Rename part"
        onClick={() => setEditing(true)}
      >
        ✎
      </button>
      <button
        type="button"
        className={"book-delete bg-none border border-[var(--ember)] text-[var(--ember)] rounded-lg py-1 px-1.5 text-[11px] hover:bg-[color-mix(in_srgb,var(--ember)_18%,transparent)]" + (armed ? " armed bg-[color-mix(in_srgb,var(--ember)_20%,transparent)]" : "")}
        onClick={confirmOrDelete}
      >
        {armed ? "Confirm?" : "Delete part"}
      </button>
    </li>
  );
});

export function ChapterList({ sections, selectedId, onSelect, onMove, onCreate, onCreatePart, onReorderPart, onRenamePart, onDeletePart }: ChapterListProps) {
  const wordsRef = useRef(new Map<string, WordCacheEntry>());
  const chapters = useMemo(() => sections.flatMap((s) => s.chapters), [sections]);
  const wordsByChapter = useMemo(() => buildWordCounts(chapters, wordsRef.current), [chapters]);
  const parts = sections.map((s) => s.part).filter((p): p is Part => p !== null);

  return (
    <aside className="book-chapters flex flex-col gap-2.5 min-h-0 p-3 bg-night border-r border-line max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:border-line">
      {chapters.length === 0 ? (
        <p className="mx-2 my-2 text-parchment-dim text-[13px]">Add the first chapter.</p>
      ) : null}
      {chapters.length > 0 || parts.length > 0 ? (
        <ul className="book-ch-rows list-none m-0 p-0.5 flex flex-col gap-1 overflow-y-auto flex-1 min-h-0" aria-label="Chapters">
          {sections.map(({ part, chapters: sectionChapters }) => (
            <Fragment key={part?.id ?? "ungrouped"}>
              {part ? (
                <PartRow
                  part={part}
                  index={parts.indexOf(part)}
                  total={parts.length}
                  words={sectionChapters.reduce((n, c) => n + (wordsByChapter.get(c.id)?.words ?? 0), 0)}
                  onReorder={onReorderPart}
                  onRename={onRenamePart}
                  onDelete={onDeletePart}
                />
              ) : null}
              {sectionChapters.map((chapter, index) => (
                <ChapterRow
                  key={chapter.id}
                  chapter={chapter}
                  index={index}
                  total={sectionChapters.length}
                  selected={chapter.id === selectedId}
                  words={wordsByChapter.get(chapter.id)?.words ?? 0}
                  onSelect={onSelect}
                  onMove={onMove}
                />
              ))}
            </Fragment>
          ))}
        </ul>
      ) : null}
      <Button className="book-ch-new self-start" onClick={onCreate}>
        New chapter
      </Button>
      <Button className="book-ch-new self-start" onClick={onCreatePart}>
        New part
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
