import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { Chapter } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { renderMarkdown } from "../entries/markdown";
import { countWords, formatWords } from "./ChapterList";

const CONFIRM_RESET_MS = 3000;

export interface ChapterEditorProps {
  chapterId: string;
  headingRef?: MutableRefObject<HTMLInputElement | null>;
  onDeleted(id: string): void;
}

export function useChapter(chapterId: string): Chapter {
  const chapter = useScriptorium((s) =>
    s.manuscripts.flatMap((m) => m.chapters).find((c) => c.id === chapterId));
  if (!chapter) throw new Error("capítulo não encontrado");
  return chapter;
}

/** Convert legacy/typed markdown into rich-editor HTML (one-way, on first edit). */
export function markdownToHtml(md: string): string {
  if (typeof document === "undefined") return md;
  const doc = new DOMParser().parseFromString(md ?? "", "text/html");
  return doc.body ? doc.body.innerHTML : "";
}

export function ChapterEditor({ chapterId, headingRef, onDeleted }: ChapterEditorProps) {
  const chapter = useChapter(chapterId);
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


  // Rich editor state: the body is a contenteditable; we hold its HTML locally
  // and commit on blur/unmount. Markdown content converts one-way on first edit.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [richHtml, setRichHtml] = useState<string | null>(null);
  const [richTick, setRichTick] = useState(0);
  const richDirtyRef = useRef(false);

  useEffect(() => {
    // chapter switched (unkeyed) -> reset local html
    richDirtyRef.current = false;
    if (/^\s*</.test(chapter.content)) setRichHtml(chapter.content);
    else setRichHtml(renderMarkdown(chapter.content) || "");
  }, [chapter.id, chapter.content]);

  useEffect(() => {
    if (richHtml !== null && bodyRef.current && bodyRef.current.innerHTML !== richHtml) {
      bodyRef.current.innerHTML = richHtml;
    }
  }, [richHtml]);

  // Switching chapters (remount) must not lose a dirty rich body — the códex
  // hook flushes drafts the same way. Capture the element in the effect (the
  // ref is already nulled by the time passive cleanups run).
  useEffect(() => {
    const el = bodyRef.current;
    const chId = chapter.id;
    return () => {
      window.clearTimeout(richTimer.current);
      if (richDirtyRef.current && el) {
        useScriptorium.getState().updateChapter(chId, { content: el.innerHTML });
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
    useScriptorium.getState().updateChapter(chapter.id, { content: bodyRef.current.innerHTML });
    setRichHtml(bodyRef.current.innerHTML);
  };
  const scheduleRichCommit = () => {
    window.clearTimeout(richTimer.current);
    richTimer.current = window.setTimeout(commitRichNow, 300);
  };

  const richExec = (cmd: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
    richDirtyRef.current = true;
    setRichHtml(null); // keep DOM as truth until blur
    setRichTick((t) => t + 1);
    scheduleRichCommit();
  };

  const onRichInput = () => {
    richDirtyRef.current = true;
    setRichHtml(null);
    setRichTick((t) => t + 1);
    scheduleRichCommit();
  };

  const onRichBlur = () => {
    commitRichNow();
  };

  // Footer count follows the DRAFT; list rows use the store.
  const words = useMemo(() => {
    if (writing && bodyRef.current) return countWords(bodyRef.current.textContent ?? "");
    void richTick; // typing re-runs this memo
    return countWords(bodyDraft.draft);
  }, [writing, bodyDraft.draft, bodyRef.current, richTick]);

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
        <>
          <RichToolbar onExec={richExec} />
          <div
            className="book-body-rich"
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Conteúdo"
            data-testid="rich-body"
            onInput={onRichInput}
            onBlur={onRichBlur}
          />
        </>
      ) : chapter.content.trim() === "" ? (
        <p className="book-md-empty">Sem conteúdo ainda.</p>
      ) : (
        <div className="md-view" dangerouslySetInnerHTML={{ __html: renderMarkdown(chapter.content) }} />
      )}
      <NotesAndLinks chapter={chapter} />
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

function RichToolbar({ onExec }: { onExec(cmd: string, value?: string): void }) {
  const [blocksOpen, setBlocksOpen] = useState(false);
  return (
    <div className="rich-toolbar">
      <button type="button" aria-label="Negrito" onClick={() => onExec("bold")}><b>B</b></button>
      <button type="button" aria-label="Itálico" onClick={() => onExec("italic")}><i>I</i></button>
      <button type="button" aria-label="Sublinhado" onClick={() => onExec("underline")}><u>U</u></button>
      <button type="button" aria-label="Lista com marcadores" onClick={() => onExec("insertUnorderedList")}>•</button>
      <button type="button" aria-label="Lista numerada" onClick={() => onExec("insertOrderedList")}>1.</button>
      <button type="button" aria-label="Alinhar à esquerda" onClick={() => onExec("justifyLeft")}>⇤</button>
      <button type="button" aria-label="Alinhar ao centro" onClick={() => onExec("justifyCenter")}>↔</button>
      <button type="button" aria-label="Alinhar à direita" onClick={() => onExec("justifyRight")}>⇥</button>
      <button type="button" aria-label="Justificar" onClick={() => onExec("justifyFull")}>≡</button>
      <button type="button" className="rich-blocks" aria-expanded={blocksOpen} onClick={() => setBlocksOpen((v) => !v)}>Blocos ▾</button>
      {blocksOpen ? (
        <div className="rich-blocks-pop" role="menu">
          {[
            ["Título 1 (H1)", "h1"],
            ["Título 2 (H2)", "h2"],
            ["Título 3 (H3)", "h3"],
            ["Parágrafo", "p"],
            ["Citação", "blockquote"],
          ].map(([label, tag]) => (
            <button
              key={tag}
              type="button"
              role="menuitem"
              onClick={() => { onExec("formatBlock", tag); setBlocksOpen(false); }}
            >{label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NotesAndLinks({ chapter }: { chapter: Chapter }) {
  const store = useScriptorium.getState;
  const noteTop = useDebouncedDraft(chapter.noteTop ?? "", (v) =>
    store().updateChapter(chapter.id, { noteTop: v || undefined }), 300);
  const noteEnd = useDebouncedDraft(chapter.noteEnd ?? "", (v) =>
    store().updateChapter(chapter.id, { noteEnd: v || undefined }), 300);
  const endMarker = useDebouncedDraft(chapter.endMarker ?? "", (v) =>
    store().updateChapter(chapter.id, { endMarker: v.trim() || undefined }), 300);
  useEffect(() => () => { noteTop.flush(); noteEnd.flush(); endMarker.flush(); });

  const calendars = useScriptorium((s) => s.calendars ?? []);
  const [calendarPickOpen, setCalendarPickOpen] = useState(false);
  const [calId, setCalId] = useState(chapter.linkedCalendarId ?? "");
  const [yy, setYy] = useState("0");
  const [mm, setMm] = useState("0");
  const [dd, setDd] = useState("1");
  const cal = calendars.find((c) => c.id === (calId || chapter.linkedCalendarId));

  return (
    <>
      <label className="book-note-field">
        <span className="field-label">Nota do autor — início</span>
        <input
          aria-label="Nota do autor — início"
          placeholder="Optional: contexto, content note, dedicação…"
          value={noteTop.draft}
          onChange={(e) => noteTop.setDraft(e.target.value)}
          onBlur={() => noteTop.flush()}
        />
      </label>
      <label className="book-note-field">
        <span className="field-label">Nota do autor — fim</span>
        <input
          aria-label="Nota do autor — fim"
          placeholder="Optional: agradecimento, tease do próximo…"
          value={noteEnd.draft}
          onChange={(e) => noteEnd.setDraft(e.target.value)}
          onBlur={() => noteEnd.flush()}
        />
      </label>
      {chapter.noteEnd || endMarker.draft ? (
        <div className="book-end-marker">
          <span aria-hidden="true">✦</span>
          <input
            aria-label="Marcador do fim do capítulo"
            placeholder={chapter.endMarker || `Fim do ${chapter.heading.replace(/^Cap/i, "Capítulo")} — editável`}
            value={endMarker.draft}
            onChange={(e) => endMarker.setDraft(e.target.value)}
            onBlur={() => endMarker.flush()}
          />
          <button type="button" className="book-mode" aria-pressed={false}
            aria-label="Remover marcador do fim"
            onClick={() => { endMarker.flush(); store().updateChapter(chapter.id, { endMarker: undefined }); }}>remover marcador</button>
        </div>
      ) : (
        <div className="book-end-marker book-end-marker-off">
          <button
            type="button"
            className="book-mode"
            aria-label="Adicionar marcador do fim"
            onClick={() => store().updateChapter(chapter.id, { endMarker: `Fim do ${chapter.heading || "capítulo"}` })}
          >+ marcador do fim</button>
        </div>
      )}

      <div className="book-cal-link" data-testid="book-cal-link">
        {chapter.linkedCalendarId && cal ? (
          <>
            <span className="book-cal-label">Data: {labelDay(chapter.calendarDayKey, cal)}</span>
            <button type="button" className="book-mode" aria-label="Desvincular calendário"
              onClick={() => { setCalId(""); store().setChapterCalendar(chapter.id, undefined); }}>desvincular</button>
          </>
        ) : (
          <button type="button" className="book-mode" aria-expanded={calendarPickOpen}
            onClick={() => setCalendarPickOpen((v) => !v)}>
            {calendars.length ? "Vincular calendário" : "Sem calendários no mundo"}
          </button>
        )}
        {calendarPickOpen && calendars.length ? (
          <div className="book-cal-picker">
            <select aria-label="Calendário" value={calId} onChange={(e) => setCalId(e.target.value)}>
              <option value="">Escolha…</option>
              {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select aria-label="Mês" value={mm} disabled={!cal} onChange={(e) => setMm(e.target.value)}>
              {(cal?.months ?? []).map((m, i) => <option key={i} value={i}>{m.name}</option>)}
            </select>
            <label className="field"><span className="field-label">Ano do evento</span>
              <input type="number" aria-label="Ano do evento" value={yy} onChange={(e) => setYy(e.target.value)} /></label>
            <label className="field"><span className="field-label">Dia</span>
              <input type="number" aria-label="Dia" value={dd} onChange={(e) => setDd(e.target.value)} /></label>
            <button
              type="button"
              disabled={!cal}
              onClick={() => {
                const mIdx = Number(mm);
                const dayIdx = Number(dd) - 1;
                const max = cal?.months[mIdx]?.days ?? 30;
                const y = Number(yy);
                if (!cal || dayIdx < 0 || dayIdx >= max || y < 0) return;
                store().setChapterCalendar(chapter.id, cal.id, `${y}:${mIdx}:${dayIdx}`);
                setCalendarPickOpen(false);
              }}
            >Vincular dia</button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function labelDay(dayKey: string | undefined, cal: NonNullable<ReturnType<typeof useScriptorium.getState>['calendars']>[number]) {
  if (!dayKey) return "sem dia";
  const [y, m, d] = dayKey.split(":").map(Number);
  return `${d + 1} de ${cal.months[m]?.name ?? "?"} · Ano ${(y || 0) + 1}`;
}
