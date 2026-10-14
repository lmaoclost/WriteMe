import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { Chapter } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { renderMarkdown } from "../entries/markdown";
import { countWords, formatWords } from "./ChapterList";

const CONFIRM_RESET_MS = 3000;

export interface ChapterEditorProps {
  chapter: Chapter;
  headingRef?: MutableRefObject<HTMLInputElement | null>;
  onDeleted(id: string): void;
}

export function ChapterEditor({ chapter, headingRef, onDeleted }: ChapterEditorProps) {
  const [writing, setWriting] = useState(true);
  const [armed, setArmed] = useState(false);
  const confirmTimerRef = useRef<number | undefined>(undefined);

  const commitHeading = useCallback((v: string) => {
    useScriptorium.getState().updateChapter(chapter.id, { heading: v });
  }, [chapter.id]);
  const commitBody = useCallback((v: string) => {
    useScriptorium.getState().updateChapter(chapter.id, { content: v });
  }, [chapter.id]);
  const headingDraft = useDebouncedDraft(chapter.heading, commitHeading);
  const bodyDraft = useDebouncedDraft(chapter.content, commitBody);

  useEffect(() => () => window.clearTimeout(confirmTimerRef.current), []);

  const flush = () => {
    headingDraft.flush();
    bodyDraft.flush();
  };

  const setMode = (next: boolean) => {
    flush();
    setWriting(next);
  };

  const confirmOrDelete = () => {
    if (armed) {
      setArmed(false);
      window.clearTimeout(confirmTimerRef.current);
      flush();
      onDeleted(chapter.id);
      return;
    }
    setArmed(true);
    confirmTimerRef.current = window.setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
  };

  // Footer count follows the DRAFT (live while typing); list rows use the store.
  const words = useMemo(() => countWords(bodyDraft.draft), [bodyDraft.draft]);

  return (
    <div className="book-editor">
      <input
        ref={headingRef}
        type="text"
        className="book-ch-heading-input"
        aria-label="Título do capítulo"
        value={headingDraft.draft}
        onChange={(e) => headingDraft.setDraft(e.target.value)}
        onBlur={flush}
      />
      <div className="book-mode-row">
        <button
          type="button"
          className="book-mode"
          aria-pressed={writing}
          onClick={() => setMode(true)}
        >
          Escrever
        </button>
        <button
          type="button"
          className="book-mode"
          aria-pressed={!writing}
          onClick={() => setMode(false)}
        >
          Prévia
        </button>
      </div>
      {writing ? (
        <textarea
          className="book-body"
          aria-label="Conteúdo"
          placeholder="Sem conteúdo ainda."
          value={bodyDraft.draft}
          onChange={(e) => bodyDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
      ) : chapter.content.trim() === "" ? (
        <p className="book-md-empty">Sem conteúdo ainda.</p>
      ) : (
        <div className="md-view" dangerouslySetInnerHTML={{ __html: renderMarkdown(chapter.content) }} />
      )}
      <footer className="book-footer">
        <span className="book-words">{formatWords(words)}</span>
        <button
          type="button"
          className={"book-delete" + (armed ? " armed" : "")}
          onClick={confirmOrDelete}
        >
          {armed ? "Confirmar?" : "Excluir capítulo"}
        </button>
      </footer>
    </div>
  );
}
