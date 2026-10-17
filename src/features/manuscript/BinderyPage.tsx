import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { BINDERY_FONTS, BINDERY_TRIMS, binderyCss, trimToPage } from "./bindery";
import { BIND_HEAD_MODES } from "../../data/schema";
import { buildBookHtml } from "./buildBook";
import "./bindery.css";

export function BinderyPage({ manuscriptId }: { manuscriptId: string }) {
  const manuscript = useScriptorium(useShallow((s) =>
    s.manuscripts.find((m) => m.id === manuscriptId)));
  const pushToast = useScriptorium((s) => s.pushToast);
  const navigate = useNavigate();
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!manuscript) pushToast("error", "Load a manuscript first.");
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
          <button type="button" disabled={manuscript.chapters.length === 0} title={manuscript.chapters.length === 0 ? "Add chapters first" : undefined}
            onClick={() => setPrinting(true)}>Print preview</button>
        </div>
      </header>
      <div className="bl-body bindery-body">
        <aside className="bl-panel bindery-panel">
          <h2>Bindery</h2>
          <div className="field">
            <span className="field-label">Typography</span>
            <select aria-label="Typography" value={b.font} onChange={(e) => set({ font: e.target.value })}>
              {BINDERY_FONTS.map((f) => <option key={f.id} value={f.stack}>{f.label}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Book size</span>
            <select aria-label="Book size" value={b.trim} onChange={(e) => set({ trim: e.target.value })}>
              {BINDERY_TRIMS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <label className="check-row">
            <input type="checkbox" aria-label="Capitulares" checked={b.dropCaps} onChange={(e) => set({ dropCaps: e.target.checked })} />
            <span>Drop caps</span>
          </label>
          <label className="check-row">
            <input type="checkbox" aria-label="Running headers" checked={b.runningHead} onChange={(e) => set({ runningHead: e.target.checked })} />
            <span>Running headers</span>
          </label>
          <div className="field">
            <span className="field-label">Chapter numbering</span>
            <select aria-label="Chapter numbering" value={b.numberingStyle ?? "arabic"} onChange={(e) => set({ numberingStyle: e.target.value as NonNullable<typeof b>["numberingStyle"] })}>
              <option value="arabic">1</option>
              <option value="chapter">Chapter 1</option>
              <option value="word">One</option>
              <option value="none">None</option>
            </select>
          </div>
          <div className="field">
            <span className="field-label">Running head mode</span>
            <select aria-label="Running head mode" value={b.runningHeadMode ?? "book"} onChange={(e) => set({ runningHeadMode: e.target.value as NonNullable<typeof b>["runningHeadMode"] })}>
              {BIND_HEAD_MODES.map((m) => <option key={m} value={m}>{m === "book" ? "Book title" : "Chapter title"}</option>)}
            </select>
          </div>
          <label className="check-row">
            <input type="checkbox" aria-label="Page numbers" checked={b.pageNumbers ?? false} onChange={(e) => set({ pageNumbers: e.target.checked })} />
            <span>Page numbers</span>
          </label>
          <label className="check-row">
            <input type="checkbox" aria-label="Title page" checked={b.titlePage} onChange={(e) => set({ titlePage: e.target.checked })} />
            <span>Title page</span>
          </label>
          <label className="check-row">
            <input type="checkbox" aria-label="Table of contents" checked={b.toc} onChange={(e) => set({ toc: e.target.checked })} />
            <span>Table of contents</span>
          </label>
          <label className="check-row">
            <input type="checkbox" aria-label="Glossary from the codex" checked={b.glossary} onChange={(e) => set({ glossary: e.target.checked })} />
            <span>Glossary (from the codex)</span>
          </label>
          <label className="field">
            <span className="field-label">Dedication</span>
            <textarea aria-label="Dedication" rows={3} defaultValue={b.dedication ?? ""} onBlur={(e) => set({ dedication: e.target.value.trim() || undefined })} />
          </label>
          <p className="bl-panel-note">Print at: {trimToPage(b.trim)} — check it in the dialog.</p>
        </aside>
        <div className="bindery-preview" data-testid="bindery-preview">
          <style>{binderyCss(b.font, b.trim, b)}</style>
          <div
            className="print-book bindery-live"
            data-testid="bindery-book"
            onClick={(e) => {
              // glossary rows link straight into the codex on screen
              const row = (e.target as HTMLElement).closest?.("tr[data-glossary]") as HTMLElement | null;
              const id = row?.getAttribute("data-glossary");
              if (id) navigate(`/p/${manuscript.projectId}/entries?e=${id}`);
            }}
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

/** Bindery index: every manuscript of the project + where it stands. */
export function BinderyIndex({ projectId }: { projectId: string }) {
  const manuscripts = useScriptorium(useShallow((s) => s.manuscripts.filter((m) => m.projectId === projectId)));

  return (
    <div className="bindery-page" data-testid="bindery-index">
      <header className="bl-header">
        <h1 className="bl-title">Bindery</h1>
      </header>
      {manuscripts.length === 0 ? (
        <p className="bindery-empty">
          No manuscripts yet.{" "}
          <Link className="bindery-create-link" to={`/p/${projectId}/manuscript`}>Open the Manuscript</Link>{" "}
          to write one.
        </p>
      ) : (
        <ul className="bindery-list">
          {manuscripts.map((m) => (
            <li key={m.id}>
              <Link className="bindery-row" to={`/p/${projectId}/bindery/${m.id}`}>
                <span className="bindery-row-title">{m.title}</span>
                <span className="bindery-row-meta">
                  {m.chapters.length} {m.chapters.length === 1 ? "chapter" : "chapters"}
                  {" · "}
                  {BINDERY_TRIMS.find((t) => t.id === (m.bindery?.trim ?? "6x9"))?.label ?? "6 × 9\""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** re-export for tests */
export { BINDERY_TRIMS, BINDERY_FONTS };
