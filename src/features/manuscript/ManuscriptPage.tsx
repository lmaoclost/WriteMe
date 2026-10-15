import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Manuscript } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { ChapterList } from "./ChapterList";
import { ChapterEditor } from "./ChapterEditor";
import { ExportTools } from "./Export";
import "./book.css";

const CONFIRM_RESET_MS = 3000;

/** Book-level inline edits (title/author) in ONE component keyed by
 *  manuscript.id at the usage site — draft isolation per book. */
function BookInputs({ manuscript }: { manuscript: Manuscript }) {
  const commitTitle = useCallback((v: string) => {
    useScriptorium.getState().renameManuscript(manuscript.id, v);
  }, [manuscript.id]);
  const commitAuthor = useCallback((v: string) => {
    useScriptorium.getState().setManuscriptAuthor(manuscript.id, v);
  }, [manuscript.id]);
  const titleDraft = useDebouncedDraft(manuscript.title, commitTitle);
  const authorDraft = useDebouncedDraft(manuscript.author, commitAuthor);
  return (
    <div className="book-meta">
      <input
        type="text"
        className="book-title-input"
        aria-label="Título do livro"
        value={titleDraft.draft}
        onChange={(e) => titleDraft.setDraft(e.target.value)}
        onBlur={titleDraft.flush}
      />
      <input
        type="text"
        className="book-author-input"
        aria-label="Autor"
        value={authorDraft.draft}
        onChange={(e) => authorDraft.setDraft(e.target.value)}
        onBlur={authorDraft.flush}
      />
    </div>
  );
}

export function ManuscriptPage({ projectId }: { projectId: string }) {
  const books = useScriptorium(
    useShallow((s) => s.manuscripts.filter((m) => m.projectId === projectId)),
  );
  const [bookId, setBookId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const confirmTimerRef = useRef<number | undefined>(undefined);
  const headingRef = useRef<HTMLInputElement | null>(null);

  // Keep the book selection pointing at a live book; default to the first one.
  useEffect(() => {
    if (bookId === null) {
      if (books.length > 0) setBookId(books[0].id);
      return;
    }
    if (!books.some((m) => m.id === bookId)) setBookId(books[0]?.id ?? null);
  }, [books, bookId]);

  const book = books.find((m) => m.id === bookId);
  const chapters = useMemo(
    () => (book ? [...book.chapters].sort((a, b) => a.order - b.order) : []),
    [book],
  );

  // Keep the chapter selection pointing at a live chapter; default to the first.
  useEffect(() => {
    if (chapterId === null) {
      if (chapters.length > 0) setChapterId(chapters[0].id);
      return;
    }
    if (!chapters.some((c) => c.id === chapterId)) setChapterId(chapters[0]?.id ?? null);
  }, [chapters, chapterId]);

  useEffect(() => {
    if (!pendingFocus || pendingFocus !== chapterId) return;
    setPendingFocus(null);
    headingRef.current?.focus();
  }, [pendingFocus, chapterId]);

  useEffect(() => {
    setArmed(false);
    window.clearTimeout(confirmTimerRef.current);
  }, [bookId]);

  useEffect(() => () => window.clearTimeout(confirmTimerRef.current), []);

  const createBook = () => {
    const created = useScriptorium.getState().addManuscript(projectId);
    setBookId(created.id);
    setChapterId(null);
  };

  const confirmOrDeleteBook = () => {
    if (armed) {
      setArmed(false);
      window.clearTimeout(confirmTimerRef.current);
      if (!bookId) return;
      const remaining = useScriptorium.getState().manuscripts
        .filter((m) => m.projectId === projectId && m.id !== bookId);
      useScriptorium.getState().deleteManuscript(bookId);
      setBookId(remaining[0]?.id ?? null);
      setChapterId(null);
      return;
    }
    setArmed(true);
    confirmTimerRef.current = window.setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
  };

  const onBookSelected = (id: string) => {
    setBookId(id);
    setChapterId(null);
  };

  const createChapter = () => {
    if (!book) return;
    const created = useScriptorium.getState().addChapter(book.id);
    if (!created) return;
    setChapterId(created.id);
    setPendingFocus(created.id);
  };

  const onChapterDeleted = (id: string) => {
    const remaining = chapters.filter((c) => c.id !== id);
    useScriptorium.getState().deleteChapter(id);
    setChapterId(remaining[0]?.id ?? null);
  };

  if (!book) {
    return (
      <div className="book book-page">
        <div className="book-empty">
          <p className="book-empty-copy">Comece o seu livro — crie o primeiro.</p>
          <button type="button" className="btn-primary" onClick={createBook}>
            Novo livro
          </button>
        </div>
      </div>
    );
  }

  const chapter = chapters.find((c) => c.id === chapterId);

  return (
    <div className="book book-page">
      <header className="book-head">
        {books.length > 1 ? (
          <select
            className="book-select"
            aria-label="Livro"
            value={book.id}
            onChange={(e) => onBookSelected(e.target.value)}
          >
            {books.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        ) : (
          <h2 className="book-title">{book.title}</h2>
        )}
        <div className="book-head-actions">
          <button type="button" className="btn-primary" onClick={createBook}>
            Novo livro
          </button>
          <button
            type="button"
            className={"book-delete" + (armed ? " armed" : "")}
            onClick={confirmOrDeleteBook}
          >
            {armed ? "Confirmar?" : "Excluir livro"}
          </button>
        </div>
      </header>
      <BookInputs key={book.id} manuscript={book} />
      <div className="book-columns">
        <ChapterList
          chapters={chapters}
          selectedId={chapterId}
          onSelect={setChapterId}
          onMove={(id, dir) => useScriptorium.getState().moveChapter(id, dir)}
          onCreate={createChapter}
        />
        <section className="book-main">
          {chapter ? (
            <ChapterEditor
              key={chapter.id}
              chapterId={chapter.id}
              headingRef={headingRef}
              onDeleted={onChapterDeleted}
            />
          ) : null}
          <ExportTools manuscript={book} />
        </section>
      </div>
    </div>
  );
}
