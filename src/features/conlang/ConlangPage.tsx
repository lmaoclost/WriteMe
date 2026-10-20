import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { pathFrom, alphabetSheetSvg, type Pt } from "../../domain/conlang";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_NOTEPAD, BOARD_NOTEPAD_HEAD, BOARD_NOTEPAD_TXT } from "../../ui/board";
import { useBoardNotesHotkey } from "../../ui/boardNotes";
import { downloadBlob, downloadUrl } from "../../data/download";


export function ConlangPage({ conlangId }: { conlangId: string }) {
  const { t } = useTranslation();
  const conlang = useScriptorium((s) => (s.conlangs ?? []).find((c) => c.id === conlangId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`cn_${conlangId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));
  const [tab, setTab] = useState<"alphabet" | "lexicon">("alphabet");
  const [selectedGlyph, setSelectedGlyph] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);

  useEffect(() => {
    if (!conlang) pushToast("error", t("conlang.page.notFound"));
  }, [conlang, pushToast, t]);

  if (!conlang) return null;

  return (
    <div className="grid grid-rows-[auto_auto_1fr] h-full" data-testid="conlang-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label={t("conlang.page.name")}
          value={conlang.name}
          onChange={(e) => useScriptorium.getState().renameConlang(conlangId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label={t("conlang.page.undo")} className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoCN(conlangId)}>↶</button>
          <button type="button" aria-label={t("conlang.page.redo")} className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoCN(conlangId)}>↷</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>{t("conlang.page.notes")}</button>
        </div>
      </header>
      <nav className="flex gap-2 px-[18px] pt-2.5" aria-label={t("conlang.page.sections")}>
        <button type="button" aria-pressed={tab === "alphabet"} onClick={() => setTab("alphabet")} className="bg-night border border-line text-slate rounded-t-sm px-4 py-2 font-display font-semibold aria-pressed:text-gold aria-pressed:border-b-gold">{t("conlang.page.alphabet")}</button>
        <button type="button" aria-pressed={tab === "lexicon"} onClick={() => setTab("lexicon")} className="bg-night border border-line text-slate rounded-t-sm px-4 py-2 font-display font-semibold aria-pressed:text-gold aria-pressed:border-b-gold">{t("conlang.page.lexicon")}</button>
      </nav>
      <div className="block border-t border-line">
        {tab === "alphabet" ? (
          <AlphabetTab conlang={conlang} selectedGlyph={selectedGlyph} onSelect={setSelectedGlyph} />
        ) : (
          <LexiconTab conlang={conlang} />
        )}
        {notesOpen ? <ConlangNotepad notes={conlang.notes} onNotes={(v) => useScriptorium.getState().setConlangNotes(conlangId, v)} onClose={() => setNotesOpen(false)} /> : null}
      </div>
    </div>
  );
}

const NEXT_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function downloadSheet(svg: string, name: string) {
  downloadUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, `${name}.svg`);
}

function AlphabetTab({ conlang, selectedGlyph, onSelect }: {
  conlang: NonNullable<ReturnType<typeof useScriptorium.getState>["conlangs"]>[number];
  selectedGlyph: string | null;
  onSelect(id: string | null): void;
}) {
  const { t, i18n } = useTranslation();
  const store = useScriptorium.getState;
  const gridRef = useRef<HTMLDivElement>(null);
  const nextLetter = () => NEXT_LETTERS.split("").find((l) => !conlang.glyphs.some((g) => g.char === l)) ?? "?" + (conlang.glyphs.length + 1);

  const exportPng = () => {
    const svg = alphabetSheetSvg(conlang.glyphs);
    const name = `${(conlang.name || "conlang").toLocaleLowerCase(i18n.language)}-${t("conlang.alphabet.fileSuffix")}`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { downloadSheet(svg, name); return; }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) { downloadSheet(svg, name); return; }
        downloadBlob(blob, `${name}.png`);
      }, "image/png");
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  return (
    <div className="conlang-alphabet">
      <div className="flex flex-wrap items-center gap-2.5 py-2.5">
        <Button
          onClick={() => {
            const g = store().addGlyph(conlang.id, nextLetter());
            if (g) onSelect(g.id);
          }}
        >{t("conlang.alphabet.newGlyph")}</Button>
        <Button kind="ghost" disabled={conlang.glyphs.length === 0} onClick={exportPng}>
          {t("conlang.alphabet.exportPng")}
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 pb-5" ref={gridRef} data-testid="glyph-grid">
        {conlang.glyphs.map((g) => (
          <button
            key={g.id}
            type="button"
            className={"w-full bg-night border border-slate rounded-lg p-2 grid gap-1.5 cursor-pointer" + (g.id === selectedGlyph ? " border-gold outline outline-1 outline-gold" : "")}
            onClick={() => onSelect(g.id)}
            aria-label={t("conlang.alphabet.glyphAria", { char: g.char })}
          >
            <span className="font-mono text-base text-gold">{g.char}</span>
            <svg viewBox="0 0 100 100" className="w-full aspect-square rounded-sm bg-[#12121e] [&_path]:fill-none [&_path]:stroke-parchment [&_path]:[stroke-width:3] [&_path]:[stroke-linecap:round]"><path d={g.svgPath} /></svg>
          </button>
        ))}
        {conlang.glyphs.length === 0 ? <p className="text-slate">{t("conlang.alphabet.empty")}</p> : null}
      </div>
      {selectedGlyph ? <GlyphEditor key={selectedGlyph} conlang={conlang} glyphId={selectedGlyph} onDone={() => onSelect(null)} /> : null}
    </div>
  );
}

function GlyphEditor({ conlang, glyphId, onDone }: {
  conlang: NonNullable<ReturnType<typeof useScriptorium.getState>["conlangs"]>[number];
  glyphId: string;
  onDone(): void;
}) {
  const { t } = useTranslation();
  const glyph = conlang.glyphs.find((g) => g.id === glyphId);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef<Pt[] | null>(null);
  const [livePath, setLivePath] = useState<string | null>(null);
  if (!glyph) return null;

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
    drawing.current = [svgPoint(e)];
    setLivePath("M " + (drawing.current[0].x) + " " + (drawing.current[0].y));
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    drawing.current.push(svgPoint(e));
    setLivePath(pathFrom(drawing.current));
  };
  const onUp = () => {
    if (!drawing.current) return;
    const d = pathFrom(drawing.current);
    drawing.current = null;
    setLivePath(null);
    if (d) useScriptorium.getState().updateGlyph(glyph.id, { svgPath: d });
  };
  const svgPoint = (e: React.PointerEvent): Pt => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  return (
    <div className="grid gap-2.5 p-4 border border-line rounded-lg mb-5" data-testid="glyph-editor">
      <div className="flex flex-wrap items-center gap-2.5 py-2.5">
        <span className="text-slate">{t("conlang.alphabet.editorTitle", { char: glyph.char })}</span>
        <Button kind="ghost" onClick={() => useScriptorium.getState().deleteGlyph(glyph.id)} aria-label={t("conlang.alphabet.deleteGlyph")}>{t("conlang.alphabet.deleteGlyph")}</Button>
        <button type="button" aria-label={t("conlang.alphabet.close")} onClick={onDone} className={BOARD_ACTION_BTN}>✕</button>
      </div>
      <div className="flex items-end gap-3">
        <Field label={t("conlang.alphabet.represents")}>
          <input
            aria-label={t("conlang.alphabet.represents")}
            defaultValue={glyph.char}
            maxLength={3}
            onBlur={(e) => {
              const v = e.target.value.trim().toUpperCase() || glyph.char;
              const dup = conlang.glyphs.some((g) => g.id !== glyph.id && g.char === v);
              const s = useScriptorium.getState();
              if (dup) { s.pushToast("error", t("conlang.alphabet.duplicate", { char: v })); e.target.value = glyph.char; return; }
              s.updateGlyph(glyph.id, { char: v });
            }}
          />
        </Field>
        <p className="text-slate">{t("conlang.alphabet.hint")}</p>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className="glyph-canvas w-[min(360px,80vw)] aspect-square rounded-lg cursor-crosshair [touch-action:none]"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <rect width="100" height="100" fill="#12121e" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="#2a2a44" strokeWidth="0.3" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#2a2a44" strokeWidth="0.3" />
        {glyph.svgPath ? <path d={glyph.svgPath} className="[fill:none] [stroke:var(--parchment)] [stroke-width:3] [stroke-linecap:round] [stroke-linejoin:round]" /> : null}
        {livePath ? <path d={livePath} className="[fill:none] [stroke:var(--gold)] [stroke-width:3] [stroke-linecap:round] [stroke-linejoin:round]" /> : null}
      </svg>
      {glyph.svgPath ? <Button kind="ghost" onClick={() => useScriptorium.getState().updateGlyph(glyph.id, { svgPath: "" })}>{t("conlang.alphabet.clearStroke")}</Button> : null}
    </div>
  );
}

const POS_OPTIONS = ["noun", "verb", "adjective", "adverb", "pronoun", "particle"] as const;

/** Stored POS values stay English; only the visible label is localized. */
function PosLabel({ value }: { value: string }) {
  const { t } = useTranslation();
  if (value === "noun") return <>{t("conlang.pos.noun")}</>;
  if (value === "verb") return <>{t("conlang.pos.verb")}</>;
  if (value === "adjective") return <>{t("conlang.pos.adjective")}</>;
  if (value === "adverb") return <>{t("conlang.pos.adverb")}</>;
  if (value === "pronoun") return <>{t("conlang.pos.pronoun")}</>;
  if (value === "particle") return <>{t("conlang.pos.particle")}</>;
  return <>{value}</>;
}

function LexiconTab({ conlang }: { conlang: NonNullable<ReturnType<typeof useScriptorium.getState>["conlangs"]>[number] }) {
  const { t, i18n } = useTranslation();
  const store = useScriptorium.getState;
  const pushToast = useScriptorium((s) => s.pushToast);
  const [filter, setFilter] = useState("");
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [pos, setPos] = useState<string>(POS_OPTIONS[0]);
  const [theme, setTheme] = useState("");

  const themes = [...new Set(conlang.words.map((w) => w.theme).filter(Boolean))];
  const needle = filter.trim().toLocaleLowerCase(i18n.language);
  const rows = conlang.words.filter((w) =>
    (needle === "" || w.word.toLocaleLowerCase(i18n.language).includes(needle) || w.meaning.toLocaleLowerCase(i18n.language).includes(needle) || w.theme.toLocaleLowerCase(i18n.language).includes(needle)),
  );

  return (
    <div className="grid gap-3 pb-10 content-start">
      <form
        className="grid grid-cols-[1fr_1.4fr_0.8fr_0.8fr_auto] gap-2 max-[900px]:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!word.trim()) return;
          const added = store().addWord(conlang.id, { word, meaning, pos, theme });
          if (added) { setWord(""); setMeaning(""); }
          else pushToast("error", t("conlang.lexicon.missingWord"));
        }}
      >
        <input aria-label={t("conlang.lexicon.newWord")} placeholder={t("conlang.lexicon.wordPlaceholder")} value={word} onChange={(e) => setWord(e.target.value)} className="bg-ink border border-line text-parchment rounded-sm px-2.5 py-2" />
        <input aria-label={t("conlang.lexicon.meaning")} placeholder={t("conlang.lexicon.meaningPlaceholder")} value={meaning} onChange={(e) => setMeaning(e.target.value)} className="bg-ink border border-line text-parchment rounded-sm px-2.5 py-2" />
        <Select aria-label={t("conlang.lexicon.partOfSpeech")} value={pos} onValueChange={(v) => setPos(v)}>
          <SelectTrigger aria-label={t("conlang.lexicon.partOfSpeech")} className="h-auto rounded-sm border-line bg-ink px-2.5 py-2 text-[15px] text-parchment hover:border-gold-dim data-[size=default]:h-auto min-w-0"><SelectValue /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            {POS_OPTIONS.map((p) => <SelectItem key={p} value={p} className="text-[15px] focus:bg-[#24233f] focus:text-parchment"><PosLabel value={p} /></SelectItem>)}
          </SelectContent>
        </Select>
        <input aria-label={t("conlang.lexicon.theme")} placeholder={t("conlang.lexicon.themePlaceholder")} value={theme} onChange={(e) => setTheme(e.target.value)} className="bg-ink border border-line text-parchment rounded-sm px-2.5 py-2" />
        <Button type="submit"><span>{t("conlang.lexicon.add")}</span></Button>
      </form>
      {themes.length ? (
        <div className="flex gap-1.5 flex-wrap">
          {themes.map((themeName) => (
            <button key={themeName} type="button" className="bg-night border border-line text-parchment-dim rounded-sm py-1 px-2.5 hover:text-gold hover:border-gold-dim" onClick={() => setFilter((f) => (f === themeName ? "" : themeName))}>
              {themeName}
            </button>
          ))}
        </div>
      ) : null}
      <input aria-label={t("conlang.lexicon.search")} placeholder={t("conlang.lexicon.searchPlaceholder")} value={filter} onChange={(e) => setFilter(e.target.value)} className="codex-search w-full bg-ink text-parchment border border-line rounded-lg px-2.5 py-[7px] text-[13px] placeholder:text-slate outline-none focus-visible:border-gold-dim" />
      <table className="w-full border-collapse text-[13px]" data-testid="lexicon-table">
        <thead>
          <tr className="text-left text-slate font-semibold [&_th]:py-1.5 [&_th]:px-2 [&_th]:border-b [&_th]:border-line"><th>{t("conlang.lexicon.wordHeader")}</th><th>{t("conlang.lexicon.meaningHeader")}</th><th>{t("conlang.lexicon.posHeader")}</th><th>{t("conlang.lexicon.themeHeader")}</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id} className="[&_td]:py-1 [&_td]:px-2 [&_td]:border-b [&_td]:border-line [&_input]:w-full [&_input]:bg-transparent [&_input]:border [&_input]:border-transparent [&_input]:text-parchment [&_input]:px-1.5 [&_input]:py-1 [&_input]:rounded-sm hover:[&_input]:border-line hover:[&_input]:bg-ink">
              <td><input aria-label={t("conlang.lexicon.wordAria", { word: w.word })} defaultValue={w.word} onBlur={(e) => store().updateWord(w.id, { word: e.target.value })} /></td>
              <td><input aria-label={t("conlang.lexicon.meaningAria", { word: w.word })} defaultValue={w.meaning} onBlur={(e) => store().updateWord(w.id, { meaning: e.target.value })} /></td>
              <td>
                <Select defaultValue={w.pos} onValueChange={(v) => store().updateWord(w.id, { pos: v })}>
                  <SelectTrigger aria-label={t("conlang.lexicon.posAria", { word: w.word })} className="w-full h-auto justify-between rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-parchment hover:border-line hover:bg-ink data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-line bg-night text-parchment">
                    {POS_OPTIONS.map((p) => <SelectItem key={p} value={p} className="text-[13px] focus:bg-[#24233f] focus:text-parchment"><PosLabel value={p} /></SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
              <td><input aria-label={t("conlang.lexicon.themeAria", { word: w.word })} defaultValue={w.theme} onBlur={(e) => store().updateWord(w.id, { theme: e.target.value })} /></td>
              <td><Button kind="danger" className="px-1.5 py-0.5 text-xs" aria-label={t("conlang.lexicon.removeAria", { word: w.word })} onClick={() => store().deleteWord(w.id)}>✕</Button></td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} className="text-slate">{t("conlang.lexicon.empty")}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function ConlangNotepad({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  const { t } = useTranslation();
  // debounced draft that flushes on unmount: closing the notepad must not
  // drop the pending <=300ms commit (the old local timer did exactly that)
  const { draft, setDraft, flush } = useDebouncedDraft(notes, onNotes);
  useEffect(() => () => flush(), [flush]);
  return (
    <div className={BOARD_NOTEPAD} data-testid="conlang-notepad">
      <header className={BOARD_NOTEPAD_HEAD}>
        <span>{t("conlang.notepad.title")}</span>
        <button type="button" aria-label={t("conlang.notepad.close")} onClick={() => { flush(); onClose(); }} className="bg-none border-0 text-slate">✕</button>
      </header>
      <textarea aria-label={t("conlang.notepad.aria")} value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} className={BOARD_NOTEPAD_TXT} />
    </div>
  );
}
