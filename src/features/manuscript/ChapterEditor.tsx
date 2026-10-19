import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { i18n } from "../../i18n";
import type { Chapter, CustomCalendar, Part } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { renderMarkdown, sanitizeFragment, isHtmlFragment } from "../entries/markdown";
import { countWords, formatWords } from "./words";

const CONFIRM_RESET_MS = 3000;

/** Radix forbids empty SelectItem values; "none" stands for no part. */
const NO_PART = "none";
const NO_PARTS: Part[] = [];

/** The chapter's manuscript parts in print order, for the part selector. */
function useChapterParts(chapterId: string): Part[] {
  const parts = useScriptorium((s) =>
    s.manuscripts.find((m) => m.chapters.some((c) => c.id === chapterId))?.parts ?? NO_PARTS);
  return useMemo(() => [...parts].sort((a, b) => a.order - b.order), [parts]);
}

export interface ChapterEditorProps {
  chapterId: string;
  headingRef?: MutableRefObject<HTMLInputElement | null>;
  onDeleted(id: string): void;
}

export function useChapter(chapterId: string): Chapter {
  const chapter = useScriptorium((s) =>
    s.manuscripts.flatMap((m) => m.chapters).find((c) => c.id === chapterId));
  if (!chapter) throw new Error("chapter not found");
  return chapter;
}

/** Convert legacy/typed markdown into rich-editor HTML (one-way, on first edit). */
export function markdownToHtml(md: string): string {
  if (typeof document === "undefined") return md;
  return sanitizeFragment(md ?? "");
}

export function ChapterEditor({ chapterId, headingRef, onDeleted }: ChapterEditorProps) {
  const { t } = useTranslation();
  const chapter = useChapter(chapterId);
  const parts = useChapterParts(chapter.id);
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
    // leaving W mode: commit whatever the live contenteditable holds right now
    // (never rely on the blur handler or the unmount capture)
    if (writing && !next) commitRichNow();
    flush();
    setWriting(next);
  };

  const confirmOrDelete = useCallback(() => {
    if (armed) {
      setArmed(false);
      window.clearTimeout(confirmTimerRef.current);
      flush();
      onDeleted(chapter.id);
      return;
    }
    setArmed(true);
    confirmTimerRef.current = window.setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
}, [armed, chapter.id, flush, onDeleted]);


  // Rich editor state: the body is a contenteditable; we hold its HTML locally
  // and commit on blur/unmount. Markdown content converts one-way on first edit.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [richHtml, setRichHtml] = useState<string | null>(null);
  const [richTick, setRichTick] = useState(0);
  const richDirtyRef = useRef(false);

  useEffect(() => {
    // chapter switched (unkeyed) -> reset local html
    richDirtyRef.current = false;
    // rich-editor HTML is user/import data (backup JSON, .docx) — sanitize
    // before it reaches the live contenteditable DOM, same as the preview path
    if (isHtmlFragment(chapter.content)) setRichHtml(sanitizeFragment(chapter.content));
    else setRichHtml(renderMarkdown(chapter.content) || "");
  }, [chapter.id, chapter.content]);

  useEffect(() => {
    if (richHtml !== null && bodyRef.current && bodyRef.current.innerHTML !== richHtml) {
      bodyRef.current.innerHTML = richHtml;
    }
    // `writing` dep: re-entering Write remounts the contenteditable empty —
    // repopulate even when richHtml already holds the committed string.
  }, [richHtml, writing]);

  // Switching chapters (remount) must not lose a dirty rich body — the códex
  // hook flushes drafts the same way. Capture the element in the effect (the
  // ref is already nulled by the time passive cleanups run).
  useEffect(() => {
    const el = bodyRef.current;
    const chId = chapter.id;
    return () => {
      window.clearTimeout(richTimer.current);
      if (richDirtyRef.current && el) {
        useScriptorium.getState().updateChapter(chId, { content: sanitizeFragment(el.innerHTML) });
      }
    };
  }, [chapter.id]);

  // autosave debounce (300ms como no códex): o rich não perde texto se o
  // usuário nunca sai do campo
  const richTimer = useRef<number | undefined>(undefined);
  const commitRichNow = () => {
    window.clearTimeout(richTimer.current);
    if (!richDirtyRef.current || !bodyRef.current) return;
    richDirtyRef.current = false;
    const html = sanitizeFragment(bodyRef.current.innerHTML);
    useScriptorium.getState().updateChapter(chapter.id, { content: html });
    setRichHtml(html);
  };
  const scheduleRichCommit = () => {
    window.clearTimeout(richTimer.current);
    richTimer.current = window.setTimeout(commitRichNow, 300);
  };

  const richExec = useCallback((cmd: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
    richDirtyRef.current = true;
    setRichHtml(null); // keep DOM as truth until blur
    setRichTick((t) => t + 1);
    scheduleRichCommit();
  }, [chapter.id]);

  const onRichInput = () => {
    richDirtyRef.current = true;
    setRichHtml(null);
    setRichTick((t) => t + 1);
    scheduleRichCommit();
  };

  const onRichBlur = () => {
    commitRichNow();
  };

  const previewHtml = useMemo(() => renderMarkdown(chapter.content), [chapter.content]);

  return (
    <div className="book-editor flex flex-col gap-2.5 max-w-[860px]">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={headingRef}
          type="text"
          className="book-ch-heading-input flex-1 min-w-0 font-display text-[1.375rem] font-semibold text-parchment bg-none border border-transparent rounded-lg px-1.5 py-0.5 hover:border-line focus:border-gold outline-none"
          aria-label={t("manuscript.chapterTitle")}
          value={headingDraft.draft}
          onChange={(e) => headingDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
        <Select value={chapter.partId ?? NO_PART} onValueChange={(v) => useScriptorium.getState().setChapterPart(chapter.id, v === NO_PART ? undefined : v)}>
          <SelectTrigger aria-label={t("manuscript.part")} className="min-w-[150px] justify-between rounded-lg border-line bg-night-2 px-2 py-1.5 text-[13px] text-parchment hover:border-gold data-[size=default]:h-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            <SelectItem value={NO_PART} className="text-[13px] focus:bg-[#24233f] focus:text-parchment">{t("manuscript.noPart")}</SelectItem>
            {parts.map((p) => <SelectItem key={p.id} value={p.id} className="text-[13px] focus:bg-[#24233f] focus:text-parchment">{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          type="button"
          className="book-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] cursor-pointer hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
          aria-pressed={writing}
          onClick={() => setMode(true)}
        >
          {t("manuscript.write")}
        </button>
        <button
          type="button"
          className="book-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] cursor-pointer hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
          aria-pressed={!writing}
          onClick={() => setMode(false)}
        >
          {t("manuscript.preview")}
        </button>
      </div>
      {writing ? (
        <>
          <RichToolbar onExec={richExec} />
          <div
            className="book-body-rich"
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={t("manuscript.content")}
            data-testid="rich-body"
            onInput={onRichInput}
            onBlur={onRichBlur}
          />
        </>
      ) : chapter.content.trim() === "" ? (
        <p className="mx-1 my-1 text-slate text-sm italic">{t("manuscript.noContent")}</p>
      ) : (
        <div className="md-view" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      )}
      <NotesAndLinks chapter={chapter} />
      <WordCountFooter
        writing={writing}
        content={chapter.content}
        richTick={richTick}
        bodyRef={bodyRef}
        richDirtyRef={richDirtyRef}
        armed={armed}
        onConfirmDelete={confirmOrDelete}
      />
    </div>
  );
}

function RichToolbar({ onExec }: { onExec(cmd: string, value?: string): void }) {
  const { t } = useTranslation();
  const [blocksOpen, setBlocksOpen] = useState(false);
  return (
    <div className="sticky top-0 z-2 flex items-center gap-0.5 w-fit max-w-[860px] bg-night-2 border border-line rounded-lg px-1.5 py-0.5 shadow-[0_4px_14px_var(--scrim-canvas)]" role="toolbar" aria-label={t("manuscript.formatting")}>
      <div className="rt-group relative flex gap-0.5 px-1">
        <button type="button" aria-label={t("manuscript.bold")} className="min-w-[26px] h-[26px] bg-transparent border-0 rounded-sm text-[#b9b3c9] text-[12.5px] cursor-pointer px-1.5 hover:bg-[#ffffff14] hover:text-parchment aria-pressed:bg-[rgb(124_92_191)] aria-pressed:text-white" onClick={() => onExec("bold")}><b>B</b></button>
        <button type="button" aria-label={t("manuscript.italic")} className="min-w-[26px] h-[26px] bg-transparent border-0 rounded-sm text-[#b9b3c9] text-[12.5px] cursor-pointer px-1.5 hover:bg-[#ffffff14] hover:text-parchment aria-pressed:bg-[rgb(124_92_191)] aria-pressed:text-white" onClick={() => onExec("italic")}><i>I</i></button>
        <button type="button" aria-label={t("manuscript.underline")} className="min-w-[26px] h-[26px] bg-transparent border-0 rounded-sm text-[#b9b3c9] text-[12.5px] cursor-pointer px-1.5 hover:bg-[#ffffff14] hover:text-parchment aria-pressed:bg-[rgb(124_92_191)] aria-pressed:text-white" onClick={() => onExec("underline")}><u>U</u></button>
      </div>
      <div className="rt-group relative flex gap-0.5 px-1 border-l border-line">
        <button type="button" aria-label={t("manuscript.bulletList")} className="min-w-[26px] h-[26px] bg-transparent border-0 rounded-sm text-[#b9b3c9] text-[12.5px] cursor-pointer px-1.5 hover:bg-[#ffffff14] hover:text-parchment aria-pressed:bg-[rgb(124_92_191)] aria-pressed:text-white" onClick={() => onExec("insertUnorderedList")}>•</button>
        <button type="button" aria-label={t("manuscript.numberedList")} className="min-w-[26px] h-[26px] bg-transparent border-0 rounded-sm text-[#b9b3c9] text-[12.5px] cursor-pointer px-1.5 hover:bg-[#ffffff14] hover:text-parchment aria-pressed:bg-[rgb(124_92_191)] aria-pressed:text-white" onClick={() => onExec("insertOrderedList")}>1.</button>
      </div>
      <div className="rt-group relative flex gap-0.5 px-1 border-l border-line">
        <button type="button" aria-label={t("manuscript.alignLeft")} className="min-w-[26px] h-[26px] bg-transparent border-0 rounded-sm text-[#b9b3c9] text-[12.5px] cursor-pointer px-1.5 hover:bg-[#ffffff14] hover:text-parchment aria-pressed:bg-[rgb(124_92_191)] aria-pressed:text-white" onClick={() => onExec("justifyLeft")}>⇤</button>
        <button type="button" aria-label={t("manuscript.alignCenter")} className="min-w-[26px] h-[26px] bg-transparent border-0 rounded-sm text-[#b9b3c9] text-[12.5px] cursor-pointer px-1.5 hover:bg-[#ffffff14] hover:text-parchment aria-pressed:bg-[rgb(124_92_191)] aria-pressed:text-white" onClick={() => onExec("justifyCenter")}>↔</button>
        <button type="button" aria-label={t("manuscript.alignRight")} className="min-w-[26px] h-[26px] bg-transparent border-0 rounded-sm text-[#b9b3c9] text-[12.5px] cursor-pointer px-1.5 hover:bg-[#ffffff14] hover:text-parchment aria-pressed:bg-[rgb(124_92_191)] aria-pressed:text-white" onClick={() => onExec("justifyRight")}>⇥</button>
        <button type="button" aria-label={t("manuscript.justify")} className="min-w-[26px] h-[26px] bg-transparent border-0 rounded-sm text-[#b9b3c9] text-[12.5px] cursor-pointer px-1.5 hover:bg-[#ffffff14] hover:text-parchment aria-pressed:bg-[rgb(124_92_191)] aria-pressed:text-white" onClick={() => onExec("justifyFull")}>≡</button>
      </div>
      <button type="button" className="rich-blocks relative w-auto bg-transparent border-0 rounded-sm text-[#b9b3c9] text-xs cursor-pointer px-2.5 py-1 hover:text-parchment" aria-expanded={blocksOpen} onClick={() => setBlocksOpen((v) => !v)}>{t("manuscript.blocks")}</button>
      {blocksOpen ? (
        <div className="rich-blocks-pop absolute top-[30px] left-0 z-10 min-w-[170px] bg-night-2 border border-line rounded-md p-1 shadow-[0_8px_22px_var(--scrim-canvas)]" role="menu">
          {[
            [t("manuscript.heading1"), "h1"],
            [t("manuscript.heading2"), "h2"],
            [t("manuscript.heading3"), "h3"],
            [t("manuscript.paragraph"), "p"],
            [t("manuscript.quote"), "blockquote"],
          ].map(([label, tag]) => (
            <button
              key={tag}
              type="button"
              role="menuitem"
              onClick={() => { onExec("formatBlock", tag); setBlocksOpen(false); }}
              className="w-full text-left py-1.5 px-2 rounded-sm text-xs text-parchment hover:bg-accent"
            >{label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const NO_CALENDARS: CustomCalendar[] = [];

const WordCountFooter = memo(function WordCountFooter({ writing, content, richTick, bodyRef, richDirtyRef, armed, onConfirmDelete }: {
  writing: boolean;
  content: string;
  richTick: number;
  bodyRef: MutableRefObject<HTMLDivElement | null>;
  richDirtyRef: MutableRefObject<boolean>;
  armed: boolean;
  onConfirmDelete(): void;
}) {
  const { t } = useTranslation();
  // Footer follows the live DOM exactly while the user types (dirty), and the
  // tag-stripped store content otherwise — never the raw HTML string.
  const words = useMemo(() => {
    void richTick; // typing re-runs this memo
    if (writing && richDirtyRef.current && bodyRef.current) {
      return countWords(bodyRef.current.innerHTML);
    }
    return countWords(content);
  }, [writing, content, richTick]);
  return (
    <footer className="flex items-center justify-between gap-2">
      <span className="book-words text-xs text-slate">{formatWords(words)}</span>
      <button
        type="button"
        className={"book-delete bg-none border border-[var(--ember)] text-[var(--ember)] rounded-lg py-1.5 px-2.5 text-[13px] hover:bg-[color-mix(in_srgb,var(--ember)_18%,transparent)]" + (armed ? " armed bg-[color-mix(in_srgb,var(--ember)_20%,transparent)]" : "")}
        onClick={onConfirmDelete}
      >
        {armed ? t("manuscript.confirm") : t("manuscript.deleteChapter")}
      </button>
    </footer>
  );
});

function NotesAndLinks({ chapter }: { chapter: Chapter }) {
  const { t } = useTranslation();
  const store = useScriptorium.getState;
  const endMarker = useDebouncedDraft(chapter.endMarker ?? "", (v) =>
    store().updateChapter(chapter.id, { endMarker: v.trim() || undefined }), 300);
  const endMarkerFlushRef = useRef(endMarker.flush);
  endMarkerFlushRef.current = endMarker.flush;
  useEffect(() => () => { endMarkerFlushRef.current(); }, []);

  const calendars = useScriptorium((s) => s.calendars ?? NO_CALENDARS);
  const [calendarPickOpen, setCalendarPickOpen] = useState(false);
  const [calId, setCalId] = useState(chapter.linkedCalendarId ?? "");
  const [yy, setYy] = useState("0");
  const [mm, setMm] = useState("0");
  const [dd, setDd] = useState("1");
  const cal = calendars.find((c) => c.id === (calId || chapter.linkedCalendarId));

  const [notesOpen, setNotesOpen] = useState(true);
  return (
    <section className="book-notes-panel border-t border-line pt-3 mt-1" data-slot="notes-panel">
      <button
        type="button"
        className="book-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] cursor-pointer hover:border-gold-dim self-start"
        aria-expanded={notesOpen}
        onClick={() => setNotesOpen((v) => !v)}
      >
        <span aria-hidden="true">{notesOpen ? "▾" : "▸"}</span> {t("manuscript.notesAndScene")}
      </button>
      <div hidden={!notesOpen} className="grid gap-3 pt-2.5">
      <div className="book-note-field flex flex-col gap-1.5">
        <span className="field-label text-xs font-semibold uppercase tracking-[0.08em] text-slate">{t("manuscript.prologue")}</span>
        <RichNoteField
          testid="rich-note-top"
          ariaLabel={t("manuscript.prologue")}
          placeholder={t("manuscript.prologuePlaceholder")}
          value={chapter.noteTop ?? ""}
          onCommit={(v) => store().updateChapter(chapter.id, { noteTop: v || undefined })}
        />
      </div>
      <div className="book-note-field flex flex-col gap-1.5">
        <span className="field-label text-xs font-semibold uppercase tracking-[0.08em] text-slate">{t("manuscript.epilogue")}</span>
        <RichNoteField
          testid="rich-note-end"
          ariaLabel={t("manuscript.epilogue")}
          placeholder={t("manuscript.epiloguePlaceholder")}
          value={chapter.noteEnd ?? ""}
          onCommit={(v) => store().updateChapter(chapter.id, { noteEnd: v || undefined })}
        />
      </div>
      {chapter.noteEnd || endMarker.draft ? (
        <div className="book-end-marker flex items-center gap-2 text-gold">
          <span aria-hidden="true">✦</span>
          <input
            aria-label={t("manuscript.endMarker")}
            placeholder={chapter.endMarker || t("manuscript.endMarkerPlaceholder", { heading: chapter.heading })}
            value={endMarker.draft}
            onChange={(e) => endMarker.setDraft(e.target.value)}
            onBlur={() => endMarker.flush()}
          />
          <button type="button" className="book-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] cursor-pointer hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold" aria-pressed={false}
            aria-label={t("manuscript.removeEndMarker")}
            onClick={() => { endMarker.flush(); store().updateChapter(chapter.id, { endMarker: undefined }); }}>{t("manuscript.removeEndMarkerShort")}</button>
        </div>
      ) : (
        <div className="book-end-marker flex items-center justify-start gap-2 text-gold">
          <button
            type="button"
            className="book-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] cursor-pointer hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
            aria-label={t("manuscript.addEndMarker")}
            onClick={() => store().updateChapter(chapter.id, { endMarker: t("manuscript.endMarkerDefault", { heading: chapter.heading || t("manuscript.chapterDefault") }) })}
          >{t("manuscript.addEndMarkerShort")}</button>
        </div>
      )}

      <div className="flex items-center gap-2" data-testid="book-cal-link">
        {chapter.linkedCalendarId && cal ? (
          <>
            <span className="text-xs text-slate">{t("manuscript.linkedDate", { date: labelDay(chapter.calendarDayKey, cal) })}</span>
            <button type="button" className="book-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] cursor-pointer hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold" aria-label={t("manuscript.unlinkCalendar")}
              onClick={() => { setCalId(""); store().setChapterCalendar(chapter.id, undefined); }}>{t("manuscript.unlink")}</button>
          </>
        ) : (
          <button type="button" className="book-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] cursor-pointer hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold" aria-expanded={calendarPickOpen}
            onClick={() => setCalendarPickOpen((v) => !v)}>
            {calendars.length ? t("manuscript.linkCalendar") : t("manuscript.noCalendars")}
          </button>
        )}
        {calendarPickOpen && calendars.length ? (
          <div className="book-cal-picker flex gap-2 items-end flex-wrap bg-night-2 border border-line rounded-lg p-2.5">
            <Select value={calId} onValueChange={(v) => setCalId(v)}>
              <SelectTrigger aria-label={t("manuscript.calendarAria")} className="justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto min-w-0"><SelectValue placeholder={t("manuscript.choose")} /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                {calendars.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs focus:bg-[#24233f] focus:text-parchment">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={mm} disabled={!cal} onValueChange={(v) => setMm(v)}>
              <SelectTrigger aria-label={t("manuscript.monthAria")} className="justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                {(cal?.months ?? []).map((m, i) => <SelectItem key={i} value={String(i)} className="text-xs focus:bg-[#24233f] focus:text-parchment">{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex flex-col gap-1"><span className="field-label text-xs font-semibold uppercase tracking-[0.08em] text-slate">{t("manuscript.eventYear")}</span>
              <input type="number" aria-label={t("manuscript.eventYear")} value={yy} onChange={(e) => setYy(e.target.value)} className="bg-ink border border-line rounded-sm text-parchment px-2 py-1.5 text-xs w-24" /></div>
            <div className="flex flex-col gap-1"><span className="field-label text-xs font-semibold uppercase tracking-[0.08em] text-slate">{t("manuscript.day")}</span>
              <input type="number" aria-label={t("manuscript.day")} value={dd} onChange={(e) => setDd(e.target.value)} className="bg-ink border border-line rounded-sm text-parchment px-2 py-1.5 text-xs w-20" /></div>
            <button
              type="button"
              disabled={!cal}
              className="bg-gold text-wax border-0 rounded-sm px-2.5 py-1.5 font-semibold text-xs cursor-pointer hover:brightness-[1.08] disabled:opacity-40"
              onClick={() => {
                const mIdx = Number(mm);
                const dayIdx = Number(dd) - 1;
                const max = cal?.months[mIdx]?.days ?? 30;
                const y = Number(yy);
                if (!cal || dayIdx < 0 || dayIdx >= max || y < 0) return;
                store().setChapterCalendar(chapter.id, cal.id, `${y}:${mIdx}:${dayIdx}`);
                setCalendarPickOpen(false);
              }}
            >{t("manuscript.linkDay")}</button>
          </div>
        ) : null}
      </div>
      </div>
    </section>
  );
}

function labelDay(dayKey: string | undefined, cal: NonNullable<ReturnType<typeof useScriptorium.getState>['calendars']>[number]) {
  if (!dayKey) return i18n.t("manuscript.noDay");
  const [y, m, d] = dayKey.split(":").map(Number);
  return i18n.t("manuscript.dayLabel", { day: d + 1, month: cal.months[m]?.name ?? "?", year: (y || 0) + 1 });
}

/** Notes and end markers are optional rich text: contenteditable that commits
 *  its HTML on blur/unmount like the chapter body does (debounced 400ms). */
function RichNoteField({ testid, ariaLabel, placeholder, value, onCommit }: {
  testid: string;
  ariaLabel: string;
  placeholder: string;
  value: string;
  onCommit(html: string): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (el && !dirtyRef.current && el.innerHTML !== value) {
      el.innerHTML = isHtmlFragment(value) ? sanitizeFragment(value) : (value.trim() ? renderMarkdown(value.trim()) : "");
    }
  }, [value]);

  const commit = () => {
    window.clearTimeout(timer.current);
    const el = ref.current;
    if (!dirtyRef.current || !el) return;
    dirtyRef.current = false;
    onCommit(sanitizeFragment(el.innerHTML).trim());
  };
  const schedule = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(commit, 400);
  };

  useEffect(() => {
    const el = ref.current;
    return () => {
      window.clearTimeout(timer.current);
      if (dirtyRef.current && el) onCommit(sanitizeFragment(el.innerHTML).trim());
    };
  }, []);

  return (
    <div
      ref={ref}
      className="book-body-rich book-note-rich"
      data-testid={testid}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      onInput={() => { dirtyRef.current = true; schedule(); }}
      onBlur={commit}
    />
  );
}
