import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { BINDERY_FONTS, BINDERY_TRIMS, binderyCss, trimToPage } from "./bindery";
import { buildBookHtml } from "./buildBook";
import "./bindery.css";

export function BinderyPage({ manuscriptId }: { manuscriptId: string }) {
  const manuscript = useScriptorium(useShallow((s) =>
    s.manuscripts.find((m) => m.id === manuscriptId)));
  const pushToast = useScriptorium((s) => s.pushToast);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!manuscript) pushToast("error", "Manuscrito não encontrado. Comece um no Manuscript.");
  }, [manuscript, pushToast]);

  // print pass: fires once the preview style is committed
  useEffect(() => {
    if (!printing) return;
    const frame = window.requestAnimationFrame(() => window.print());
    const stop = window.setTimeout(() => setPrinting(false), PRINT_SETTLE_MS);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(stop); };
  }, [printing]);

  if (!manuscript) return null;

  const b = manuscript.bindery ?? {
    font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true, titlePage: true, toc: true, glossary: false,
  };
  const set = (patch: Partial<NonNullable<typeof b>>) => useScriptorium.getState().setBindery(manuscriptId, patch);
  const html = useMemo(() => buildBookHtml(manuscript), [manuscript]);

  return (
    <div className="bindery-page" data-testid="bindery-page">
      <header className="bl-header">
        <div className="bl-name-noneditable">{manuscript.title}</div>
        <div className="bl-actions">
          <button type="button" disabled={manuscript.chapters.length === 0} title={manuscript.chapters.length === 0 ? "Adicione capítulos primeiro" : undefined}
            onClick={() => setPrinting(true)}>Prévia impressa</button>
        </div>
      </header>
      <div className="bl-body bindery-body">
        <aside className="bl-panel bindery-panel">
          <h2>Encadernação</h2>
          <div className="field">
            <span className="field-label">Tipografia</span>
            <select aria-label="Tipografia" value={b.font} onChange={(e) => set({ font: e.target.value })}>
              {BINDERY_FONTS.map((f) => <option key={f.id} value={f.stack}>{f.label}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Tamanho do livro</span>
            <select aria-label="Tamanho do livro" value={b.trim} onChange={(e) => set({ trim: e.target.value })}>
              {BINDERY_TRIMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <label className="check-row">
            <input type="checkbox" aria-label="Capitulares" checked={b.dropCaps} onChange={(e) => set({ dropCaps: e.target.checked })} />
            <span>Capitulares (drop caps)</span>
          </label>
          <label className="check-row">
            <input type="checkbox" aria-label="Cabeçalhos corridos" checked={b.runningHead} onChange={(e) => set({ runningHead: e.target.checked })} />
            <span>Cabeçalhos corridos</span>
          </label>
          <label className="check-row">
            <input type="checkbox" aria-label="Página de título" checked={b.titlePage} onChange={(e) => set({ titlePage: e.target.checked })} />
            <span>Página de título</span>
          </label>
          <label className="check-row">
            <input type="checkbox" aria-label="Sumário" checked={b.toc} onChange={(e) => set({ toc: e.target.checked })} />
            <span>Sumário</span>
          </label>
          <label className="check-row">
            <input type="checkbox" aria-label="Glossário do códex" checked={b.glossary} onChange={(e) => set({ glossary: e.target.checked })} />
            <span>Glossário (do códex)</span>
          </label>
          <label className="field">
            <span className="field-label">Dedicatória</span>
            <textarea aria-label="Dedicatória" rows={3} defaultValue={b.dedication ?? ""} onBlur={(e) => set({ dedication: e.target.value.trim() || undefined })} />
          </label>
          <p className="bl-panel-note">Impressão: {trimToPage(b.trim)} — confira no diálogo.</p>
        </aside>
        <div className="bindery-preview" data-testid="bindery-preview">
          <style>{binderyCss(b.font, b.trim, b)}</style>
          <div
            className="print-book bindery-live"
            data-testid="bindery-book"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
      {/* Print pass: portal not needed — body-level CSS hides shell when printing. */}
      <style>{printing ? `${binderyCss(b.font, b.trim, b)}
        @media print { .workspace, .toasts, .bindery-panel { display: none !important; } .bindery-live { display: block !important; } .print-book { display: block !important; } }
        @media screen { .bindery-live { display: block; } }
      ` : ""}</style>
    </div>
  );
}

const PRINT_SETTLE_MS = 800;

/** re-export for tests */
export { BINDERY_TRIMS, BINDERY_FONTS };