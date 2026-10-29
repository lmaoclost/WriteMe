import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { Manuscript } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { undoToastAction } from "../../ui/undoAction";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { ChapterList } from "./ChapterList";
import { ChapterEditor } from "./ChapterEditor";
import { bookSections } from "./buildBook";
import { Button } from "../../ui/Button";
import { FocusToggle } from "../workspace/focus";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CONFIRM_RESET_MS = 3000;

/** Book-level inline edits (title/author) in ONE component keyed by
 *  manuscript.id at the usage site — draft isolation per book. */
function BookInputs({ manuscript }: { manuscript: Manuscript }) {
  const { t } = useTranslation();
  const commitTitle = useCallback((v: string) => {
    useScriptorium.getState().renameManuscript(manuscript.id, v);
  }, [manuscript.id]);
  const commitAuthor = useCallback((v: string) => {
    useScriptorium.getState().setManuscriptAuthor(manuscript.id, v);
  }, [manuscript.id]);
  const titleDraft = useDebouncedDraft(manuscript.title, commitTitle);
  const authorDraft = useDebouncedDraft(manuscript.author, commitAuthor);
  return (
    <div className="flex gap-2 px-4 pt-2.5">
      <input
        type="text"
        className="book-title-input flex-1 min-w-0 font-display text-lg font-semibold text-parchment bg-ink border border-line rounded-lg px-2.5 py-1.5 outline-none focus:border-gold"
        aria-label={t("manuscript.titleAria")}
        value={titleDraft.draft}
        onChange={(e) => titleDraft.setDraft(e.target.value)}
        onBlur={titleDraft.flush}
      />
      <input
        type="text"
        className="book-author-input w-[220px] text-[13px] text-parchment bg-ink border border-line rounded-lg px-2.5 py-1.5 outline-none focus:border-gold"
        aria-label={t("manuscript.author")}
        value={authorDraft.draft}
        onChange={(e) => authorDraft.setDraft(e.target.value)}
        onBlur={authorDraft.flush}
      />
    </div>
  );
}

export function ManuscriptPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
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
  // The list renders exactly the print plan: ungrouped run first, then one
  // block per part, both in bookSections order.
  const sections = useMemo(() => (book ? bookSections(book) : []), [book]);

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
      useScriptorium.getState().pushToast("success", t("manuscript.bookDeleted"), undoToastAction());
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
      <div className="grid grid-rows-[auto_auto_1fr] h-full min-h-0">
        <div className="flex flex-col items-center justify-center gap-3.5 p-6">
          <h1 className="m-0 font-display text-[22px] font-semibold text-parchment-strong">{t("manuscript.title")}</h1>
          <p className="m-0 text-slate text-sm">{t("manuscript.purpose")}</p>
          <p className="m-0 text-parchment-dim text-sm">{t("manuscript.empty")}</p>
          <Button onClick={createBook}>
            {t("manuscript.newBook")}
          </Button>
        </div>
      </div>
    );
  }

  const chapter = chapters.find((c) => c.id === chapterId);

  return (
    <div className="grid grid-rows-[auto_auto_1fr] h-full min-h-0">
      <header className="flex items-center gap-2.5 px-4 pt-3">
        {books.length > 1 ? (
          <Select value={book.id} onValueChange={(v) => onBookSelected(v)}>
            <SelectTrigger aria-label={t("manuscript.bookAria")} className="min-w-[180px] justify-between rounded-lg border-line bg-night-2 px-2 py-1.5 text-[13px] text-parchment hover:border-gold data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
            <SelectContent className="border-line bg-night text-parchment">
              {books.map((m) => <SelectItem key={m.id} value={m.id} className="text-[13px] focus:bg-accent focus:text-parchment">{m.title}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <h2 className="book-title flex-1 m-0 font-display text-[22px] font-semibold text-parchment overflow-hidden text-ellipsis whitespace-nowrap">{book.title}</h2>
        )}
        <div className="flex gap-2 ml-auto">
          <FocusToggle />
          <Button onClick={createBook}>
            {t("manuscript.newBook")}
          </Button>
          <button
            type="button"
            className={"book-delete bg-none border border-[var(--ember)] text-[var(--ember)] rounded-lg py-1.5 px-2.5 text-[13px] hover:bg-[color-mix(in_srgb,var(--ember)_18%,transparent)]" + (armed ? " armed bg-[color-mix(in_srgb,var(--ember)_20%,transparent)]" : "")}
            onClick={confirmOrDeleteBook}
          >
            {armed ? t("manuscript.confirm") : t("manuscript.deleteBook")}
          </button>
        </div>
      </header>
      <BookInputs key={book.id} manuscript={book} />
      <div className="grid grid-cols-[300px_1fr] min-h-0 pt-3 max-[720px]:grid-cols-1 max-[720px]:grid-rows-[auto_1fr]">
        <ChapterList
          sections={sections}
          selectedId={chapterId}
          onSelect={setChapterId}
          onMove={(id, dir) => useScriptorium.getState().moveChapter(id, dir)}
          onCreate={createChapter}
          onCreatePart={() => { useScriptorium.getState().addPart(book.id); }}
          onReorderPart={(id, dir) => useScriptorium.getState().reorderPart(id, dir)}
          onRenamePart={(id, title) => useScriptorium.getState().renamePart(id, title)}
          onDeletePart={(id) => useScriptorium.getState().removePart(id)}
        />
        <section className="min-h-0 overflow-y-auto py-1 px-6 pb-[18px] flex flex-col gap-3.5">
          {chapter ? (
            <ChapterEditor
              key={chapter.id}
              chapterId={chapter.id}
              headingRef={headingRef}
              onDeleted={onChapterDeleted}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}
