import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { pathFrom, alphabetSheetSvg, type Pt } from "../../domain/conlang";
import "./conlang.css";

export function ConlangPage({ conlangId }: { conlangId: string }) {
  const conlang = useScriptorium((s) => (s.conlangs ?? []).find((c) => c.id === conlangId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`cn_${conlangId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));
  const [tab, setTab] = useState<"alphabet" | "lexicon">("alphabet");
  const [selectedGlyph, setSelectedGlyph] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!conlang) pushToast("error", "Conlang not found.");
  }, [conlang, pushToast]);

  if (!conlang) return null;

  return (
    <div className="conlang-page" data-testid="conlang-page">
      <header className="bl-header">
        <input
          className="bl-name"
          aria-label="Conlang name"
          value={conlang.name}
          onChange={(e) => useScriptorium.getState().renameConlang(conlangId, e.target.value)}
        />
        <div className="bl-actions">
          <button type="button" aria-label="Undo" disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoCN(conlangId)}>↶</button>
          <button type="button" aria-label="Redo" disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoCN(conlangId)}>↷</button>
          <button type="button" onClick={() => setNotesOpen((v) => !v)}>Notes</button>
        </div>
      </header>
      <nav className="conlang-tabs" aria-label="Conlang sections">
        <button type="button" aria-pressed={tab === "alphabet"} onClick={() => setTab("alphabet")}>Alphabet</button>
        <button type="button" aria-pressed={tab === "lexicon"} onClick={() => setTab("lexicon")}>Lexicon</button>
      </nav>
      <div className="bl-body bl-body-full">
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
  const a = document.createElement("a");
  a.href = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  a.download = `${name}.svg`;
  a.click();
}

function AlphabetTab({ conlang, selectedGlyph, onSelect }: {
  conlang: NonNullable<ReturnType<typeof useScriptorium.getState>["conlangs"]>[number];
  selectedGlyph: string | null;
  onSelect(id: string | null): void;
}) {
  const store = useScriptorium.getState;
  const gridRef = useRef<HTMLDivElement>(null);
  const nextLetter = () => NEXT_LETTERS.split("").find((l) => !conlang.glyphs.some((g) => g.char === l)) ?? "?" + (conlang.glyphs.length + 1);

  const exportPng = () => {
    const svg = alphabetSheetSvg(conlang.glyphs);
    const name = `${(conlang.name || "conlang").toLowerCase()}-alfabeto`;
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
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  return (
    <div className="conlang-alphabet">
      <div className="conlang-actions-row">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const g = store().addGlyph(conlang.id, nextLetter());
            if (g) onSelect(g.id);
          }}
        >New glyph</button>
        <button type="button" className="btn-ghost" disabled={conlang.glyphs.length === 0} onClick={exportPng}>
          Exportar folha (PNG)
        </button>
      </div>
      <div className="conlang-grid" ref={gridRef} data-testid="glyph-grid">
        {conlang.glyphs.map((g) => (
          <button
            key={g.id}
            type="button"
            className={"glyph-cell" + (g.id === selectedGlyph ? " selected" : "")}
            onClick={() => onSelect(g.id)}
            aria-label={`Glifo ${g.char}`}
          >
            <span className="glyph-char">{g.char}</span>
            <svg viewBox="0 0 100 100" className="glyph-preview"><path d={g.svgPath} /></svg>
          </button>
        ))}
        {conlang.glyphs.length === 0 ? <p className="dim">Sem glifos — adicione e desenhe.</p> : null}
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
    <div className="glyph-editor" data-testid="glyph-editor">
      <div className="conlang-actions-row">
        <span className="dim">Glifo {glyph.char} — desenhe com o mouse</span>
        <button
          type="button"
          className="btn-danger"
          aria-label={`Excluir glifo ${glyph.char}`}
          onClick={() => { useScriptorium.getState().deleteGlyph(glyph.id); onDone(); }}
        >Delete glyph</button>
        <button type="button" aria-label="Close glyph editor" onClick={onDone}>✕</button>
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className="glyph-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <rect width="100" height="100" fill="#12121e" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="#2a2a44" strokeWidth="0.3" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#2a2a44" strokeWidth="0.3" />
        {glyph.svgPath ? <path d={glyph.svgPath} className="glyph-path" /> : null}
        {livePath ? <path d={livePath} className="glyph-path glyph-live" /> : null}
      </svg>
      {glyph.svgPath ? <button type="button" className="btn-ghost" onClick={() => useScriptorium.getState().updateGlyph(glyph.id, { svgPath: "" })}>Clear stroke</button> : null}
    </div>
  );
}

const POS_OPTIONS = ["noun", "verb", "adjective", "adverb", "pronoun", "particle"];

function LexiconTab({ conlang }: { conlang: NonNullable<ReturnType<typeof useScriptorium.getState>["conlangs"]>[number] }) {
  const store = useScriptorium.getState;
  const pushToast = useScriptorium((s) => s.pushToast);
  const [filter, setFilter] = useState("");
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [pos, setPos] = useState(POS_OPTIONS[0]);
  const [theme, setTheme] = useState("");

  const themes = [...new Set(conlang.words.map((w) => w.theme).filter(Boolean))];
  const needle = filter.trim().toLowerCase();
  const rows = conlang.words.filter((w) =>
    (needle === "" || w.word.toLowerCase().includes(needle) || w.meaning.toLowerCase().includes(needle) || w.theme.toLowerCase().includes(needle)),
  );

  return (
    <div className="conlang-lexicon">
      <form
        className="conlang-word-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!word.trim()) return;
          const added = store().addWord(conlang.id, { word, meaning, pos, theme });
          if (added) { setWord(""); setMeaning(""); }
          else pushToast("error", "Escreva a palavra.");
        }}
      >
        <input aria-label="New word" placeholder="Word..." value={word} onChange={(e) => setWord(e.target.value)} />
        <input aria-label="Meaning" placeholder="Meaning..." value={meaning} onChange={(e) => setMeaning(e.target.value)} />
        <select aria-label="Part of speech" value={pos} onChange={(e) => setPos(e.target.value)}>
          {POS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input aria-label="Theme group" placeholder="Tema…" value={theme} onChange={(e) => setTheme(e.target.value)} />
        <button type="submit" className="btn-primary">Add</button>
      </form>
      {themes.length ? (
        <div className="conlang-themes">
          {themes.map((t) => (
            <button key={t} type="button" className="codex-chip-button" onClick={() => setFilter((f) => (f === t ? "" : t))}>
              {t}
            </button>
          ))}
        </div>
      ) : null}
      <input aria-label="Search the lexicon" placeholder="Search the lexicon..." value={filter} onChange={(e) => setFilter(e.target.value)} className="codex-search" />
      <table className="conlang-table" data-testid="lexicon-table">
        <thead>
          <tr><th>Word</th><th>Meaning</th><th>Part of speech</th><th>Theme</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id}>
              <td><input aria-label={`Palavra ${w.word}`} defaultValue={w.word} onBlur={(e) => store().updateWord(w.id, { word: e.target.value })} /></td>
              <td><input aria-label={`Meaning of ${w.word}`} defaultValue={w.meaning} onBlur={(e) => store().updateWord(w.id, { meaning: e.target.value })} /></td>
              <td>
                <select aria-label={`Classe de ${w.word}`} defaultValue={w.pos} onChange={(e) => store().updateWord(w.id, { pos: e.target.value })}>
                  {POS_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td><input aria-label={`Tema de ${w.word}`} defaultValue={w.theme} onBlur={(e) => store().updateWord(w.id, { theme: e.target.value })} /></td>
              <td><button type="button" className="btn-danger" aria-label={`Remover ${w.word}`} onClick={() => store().deleteWord(w.id)}>✕</button></td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={5} className="dim">The lexicon is empty — add the first word.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function ConlangNotepad({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => {
    const id = setTimeout(() => { if (draft !== notes) onNotes(draft); }, 300);
    return () => clearTimeout(id);
  }, [draft, notes, onNotes]);
  return (
    <div className="bl-notepad" data-testid="conlang-notepad">
      <header className="bl-notepad-head">
        <span>Notes</span>
        <button type="button" aria-label="Fechar notas" onClick={onClose}>✕</button>
      </header>
      <textarea aria-label="Conlang notes" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
    </div>
  );
}
