import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { BINDERY_FONTS, BINDERY_TRIMS, estimatePageCount, trimToPage } from "./bindery";
import { buildBookCss } from "./bookCss";
import { ExportButtons } from "./Export";
import { BIND_HEAD_MODES, BIND_SCENE_ORNAMENTS, defaultBindery } from "../../data/schema";
import { PRESETS, applyPreset } from "./presets";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../ui/Field";
import { BOARD_HEADER, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_PANEL } from "../../ui/board";
import { buildBookHtml, bookSections } from "./buildBook";
import type { BinderPreset, BinderyConfig, SceneOrnament } from "../../domain/types";

/** Nested bindery blocks — a control inside one must write the whole block. */
type NestedBlock = "typography" | "geometry" | "opener" | "frontMatter" | "backMatter";

const ORNAMENT_LABELS: Record<SceneOrnament, string> = {
  blank: "None", asterisks: "Asterisks", asterism: "Asterism", fleuron: "Fleuron", rule: "Rule",
};

const GROUP_DETAILS = "border-t border-line pt-2";
const GROUP_SUMMARY = "cursor-pointer select-none text-[13px] font-semibold text-parchment-dim hover:text-parchment";
const GROUP_BODY = "mt-2 flex flex-col gap-2.5";
const SELECT_TRIGGER_CLS = "w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto";
const SELECT_POP_CLS = "border-line bg-night text-parchment";
const SELECT_ITEM_CLS = "text-xs focus:bg-[#24233f] focus:text-parchment";

/** Number field that ignores half-typed values (clearing snaps back to the
 *  stored number instead of committing NaN). */
function NumField({ label, value, step, onCommit }: { label: string; value: number; step: number; onCommit: (n: number) => void }) {
  return (
    <Field label={label}>
      <input type="number" aria-label={label} step={step} value={value}
        onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) onCommit(n); }} />
    </Field>
  );
}

/** Checkbox row of the panel, for the v2 nested blocks. */
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
      <input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Short text field committing on every change; callers trim. */
function TextRow({ label, value, disabled, onCommit }: { label: string; value: string | undefined; disabled?: boolean | undefined; onCommit: (v: string) => void }) {
  return (
    <Field label={label}>
      <input type="text" aria-label={label} value={value ?? ""} disabled={disabled} onChange={(e) => onCommit(e.target.value)} />
    </Field>
  );
}

/** Textarea field committing on blur, like Dedication; empty clears to undefined. */
function TextAreaRow({ label, rows, value, onCommit }: { label: string; rows: number; value: string | undefined; onCommit: (v: string | undefined) => void }) {
  return (
    <Field label={label}>
      <textarea aria-label={label} rows={rows} defaultValue={value ?? ""} onBlur={(e) => onCommit(e.target.value.trim() || undefined)} />
    </Field>
  );
}

export function BinderyPage({ manuscriptId }: { manuscriptId: string }) {
  const manuscript = useScriptorium(useShallow((s) =>
    s.manuscripts.find((m) => m.id === manuscriptId)));
  const pushToast = useScriptorium((s) => s.pushToast);
  const navigate = useNavigate();
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!manuscript) pushToast("error", "Load a manuscript first.");
  }, [manuscript, pushToast]);

  // print pass: fires once the body-level print-book portal is in the DOM
  useEffect(() => {
    if (!printing) return;
    let settled = false;
    const stop = () => {
      if (settled) return;
      settled = true;
      setPrinting(false);
    };
    const frame = window.requestAnimationFrame(() => window.print());
    window.addEventListener("afterprint", stop);
    const timeout = window.setTimeout(stop, PRINT_SETTLE_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", stop);
      window.clearTimeout(timeout);
    };
  }, [printing]);

  const b = useMemo(
    () => manuscript?.bindery ?? { ...defaultBindery()!, runningHeadMode: "book" as const },
    [manuscript],
  );
  const set = (patch: Partial<NonNullable<typeof b>>) => useScriptorium.getState().setBindery(manuscriptId, patch);
  const def = defaultBindery()!;
  const t = { ...def.typography!, ...b.typography };
  const g = { ...def.geometry!, ...b.geometry };
  const o = { ...def.opener!, ...b.opener };
  const fm = { ...def.frontMatter!, ...b.frontMatter };
  const bm = { aboutAuthor: b.backMatter?.aboutAuthor, colophon: b.backMatter?.colophon ?? false };
  /** buildBookHtml merges the stored bindery over the defaults one level deep,
   *  so a partial stored block would shed its siblings — every nested write
   *  stores the complete block (defaults ← stored ← patch). Exception:
   *  backMatter writes leave glossary absent so buildBook's legacy-glossary
   *  fallback keeps running from the top-level switch. */
  const setBlock = <K extends NestedBlock>(key: K, patch: Partial<NonNullable<BinderyConfig[K]>>) => {
    const block: NonNullable<BinderyConfig[K]> = { ...def[key], ...b[key], ...patch };
    const next: Partial<BinderyConfig> = {};
    next[key] = block;
    set(next);
  };
  const setInfo = (key: "year" | "holder" | "isbn" | "edition", v: string) =>
    setBlock("frontMatter", { copyrightInfo: { ...fm.copyrightInfo, [key]: v.trim() || undefined } });
  const html = useMemo(() => (manuscript ? buildBookHtml(manuscript) : ""), [manuscript]);
  const css = useMemo(
    () => (manuscript ? buildBookCss(b, {
      title: manuscript.title,
      // render order keeps the chN named pages in step with data-ch
      chapters: bookSections(manuscript).flatMap((s) => s.chapters).map((c) => ({ heading: c.heading, partId: c.partId })),
      parts: manuscript.parts ?? [],
      pageCount: estimatePageCount(manuscript),
    }) : ""),
    [manuscript, b],
  );

  if (!manuscript) return null;

  return (
    <div className="bindery-page grid grid-rows-[auto_1fr] h-full" data-testid="bindery-page">
      <header className={BOARD_HEADER}>
        <div className="font-display text-xl font-semibold text-gold">{manuscript.title}</div>
        <div className={BOARD_ACTIONS}>
          <ExportButtons manuscript={manuscript} />
          <button type="button" className={BOARD_ACTION_BTN} disabled={manuscript.chapters.length === 0} title={manuscript.chapters.length === 0 ? "Add chapters first" : undefined}
            onClick={() => setPrinting(true)}>Print preview</button>
        </div>
      </header>
      <div className="grid grid-cols-[300px_1fr] min-h-0 overflow-hidden">
        <aside className={`${BOARD_PANEL} [&_h2]:text-[1.125rem] [&_h2]:mb-2.5`}>
          <h2>Publishing</h2>
          <Field label="Style preset">
            <Select value={b.preset ?? "classic"} onValueChange={(v) => set(applyPreset(b, v as BinderPreset))}>
              <SelectTrigger aria-label="Style preset" data-testid="bindery-preset" className={SELECT_TRIGGER_CLS}><SelectValue /></SelectTrigger>
              <SelectContent className={SELECT_POP_CLS}>
                {PRESETS.map((p) => <SelectItem key={p.id} value={p.id} className={SELECT_ITEM_CLS}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Typography">
            <Select value={b.font} onValueChange={(v) => set({ font: v })}>
              <SelectTrigger aria-label="Typography" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                {BINDERY_FONTS.map((f) => <SelectItem key={f.id} value={f.stack} className="text-xs focus:bg-[#24233f] focus:text-parchment">{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Book size">
            <Select value={b.trim} onValueChange={(v) => set({ trim: v })}>
              <SelectTrigger aria-label="Book size" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                {BINDERY_TRIMS.map((t) => <SelectItem key={t.id} value={t.id} className="text-xs focus:bg-[#24233f] focus:text-parchment">{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
            <input type="checkbox" aria-label="Capitulares" checked={b.dropCaps} onChange={(e) => set({ dropCaps: e.target.checked })} />
            <span>Drop caps</span>
          </label>
          <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
            <input type="checkbox" aria-label="Running headers" checked={b.runningHead} onChange={(e) => set({ runningHead: e.target.checked })} />
            <span>Running headers</span>
          </label>
          <Field label="Chapter numbering">
            <Select value={b.numberingStyle ?? "arabic"} onValueChange={(v) => set({ numberingStyle: v as NonNullable<typeof b>["numberingStyle"] })}>
              <SelectTrigger aria-label="Chapter numbering" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                <SelectItem value="arabic" className="text-xs focus:bg-[#24233f] focus:text-parchment">1</SelectItem>
                <SelectItem value="chapter" className="text-xs focus:bg-[#24233f] focus:text-parchment">Chapter 1</SelectItem>
                <SelectItem value="word" className="text-xs focus:bg-[#24233f] focus:text-parchment">One</SelectItem>
                <SelectItem value="none" className="text-xs focus:bg-[#24233f] focus:text-parchment">None</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Running head mode">
            <Select value={b.runningHeadMode ?? "book"} onValueChange={(v) => set({ runningHeadMode: v as NonNullable<typeof b>["runningHeadMode"] })}>
              <SelectTrigger aria-label="Running head mode" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                {BIND_HEAD_MODES.map((m) => <SelectItem key={m} value={m} className="text-xs focus:bg-[#24233f] focus:text-parchment">{m === "book" ? "Book title" : "Chapter title"}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
            <input type="checkbox" aria-label="Page numbers" checked={b.pageNumbers ?? false} onChange={(e) => set({ pageNumbers: e.target.checked })} />
            <span>Page numbers</span>
          </label>
          <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
            <input type="checkbox" aria-label="Title page" checked={b.titlePage} onChange={(e) => set({ titlePage: e.target.checked })} />
            <span>Title page</span>
          </label>
          <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
            <input type="checkbox" aria-label="Table of contents" checked={b.toc} onChange={(e) => set({ toc: e.target.checked })} />
            <span>Table of contents</span>
          </label>
          <label className="flex gap-2 items-center text-[13px] text-parchment-dim">
            <input type="checkbox" aria-label="Glossary from the codex" checked={b.glossary} onChange={(e) => set({ glossary: e.target.checked })} />
            <span>Glossary (from the codex)</span>
          </label>
          <Field label="Dedication">
            <textarea aria-label="Dedication" rows={3} defaultValue={b.dedication ?? ""} onBlur={(e) => set({ dedication: e.target.value.trim() || undefined })} />
          </Field>
          <details className={GROUP_DETAILS}>
            <summary className={GROUP_SUMMARY}>Body text</summary>
            <div className={GROUP_BODY}>
              <NumField label="Body size (pt)" step={0.5} value={t.bodyPt} onCommit={(n) => setBlock("typography", { bodyPt: n })} />
              <NumField label="Leading (pt)" step={0.5} value={t.leading} onCommit={(n) => setBlock("typography", { leading: n })} />
              <NumField label="Indent (em)" step={0.25} value={t.indent} onCommit={(n) => setBlock("typography", { indent: n })} />
              <CheckRow label="Justify" checked={t.justify} onChange={(v) => setBlock("typography", { justify: v })} />
              <CheckRow label="Hyphenation" checked={t.hyphens} onChange={(v) => setBlock("typography", { hyphens: v })} />
            </div>
          </details>
          <details className={GROUP_DETAILS}>
            <summary className={GROUP_SUMMARY}>Page geometry</summary>
            <div className={GROUP_BODY}>
              <Field label="Gutter">
                <Select value={typeof g.gutter === "number" ? "manual" : "auto"}
                  onValueChange={(v) => setBlock("geometry", { gutter: v === "auto" ? "auto" : typeof g.gutter === "number" ? g.gutter : 0.5 })}>
                  <SelectTrigger aria-label="Gutter" className={SELECT_TRIGGER_CLS}><SelectValue /></SelectTrigger>
                  <SelectContent className={SELECT_POP_CLS}>
                    <SelectItem value="auto" className={SELECT_ITEM_CLS}>Auto (KDP)</SelectItem>
                    <SelectItem value="manual" className={SELECT_ITEM_CLS}>Manual (inches)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {typeof g.gutter === "number" && (
                <NumField label="Gutter (in)" step={0.0625} value={g.gutter} onCommit={(n) => setBlock("geometry", { gutter: n })} />
              )}
              <CheckRow label="Mirrored margins" checked={g.mirrored} onChange={(v) => setBlock("geometry", { mirrored: v })} />
            </div>
          </details>
          <details className={GROUP_DETAILS}>
            <summary className={GROUP_SUMMARY}>Chapter openers</summary>
            <div className={GROUP_BODY}>
              <NumField label="Chapter opener sink" step={0.01} value={o.sink} onCommit={(n) => setBlock("opener", { sink: n })} />
              <CheckRow label="Suppress running head on openers" checked={o.suppressHead} onChange={(v) => setBlock("opener", { suppressHead: v })} />
              <CheckRow label="Suppress folio on openers" checked={o.suppressFolio} onChange={(v) => setBlock("opener", { suppressFolio: v })} />
              <p className="text-slate text-xs leading-relaxed" data-testid="opener-hint">
                O Chromium não esconde cabeça nem fólio no meio da página: qualquer supressão acima coloca a abertura do capítulo em página própria, e o texto começa na próxima página.
              </p>
            </div>
          </details>
          <details className={GROUP_DETAILS}>
            <summary className={GROUP_SUMMARY}>Front matter</summary>
            <div className={GROUP_BODY}>
              <CheckRow label="Half title" checked={fm.halfTitle} onChange={(v) => setBlock("frontMatter", { halfTitle: v })} />
              <CheckRow label="Copyright page" checked={fm.copyright} onChange={(v) => setBlock("frontMatter", { copyright: v })} />
              {/* the sub-fields only act with the copyright page on */}
              <TextRow label="Copyright year" value={fm.copyrightInfo?.year} disabled={!fm.copyright} onCommit={(v) => setInfo("year", v)} />
              <TextRow label="Copyright holder" value={fm.copyrightInfo?.holder} disabled={!fm.copyright} onCommit={(v) => setInfo("holder", v)} />
              <TextRow label="ISBN" value={fm.copyrightInfo?.isbn} disabled={!fm.copyright} onCommit={(v) => setInfo("isbn", v)} />
              <TextRow label="Edition" value={fm.copyrightInfo?.edition} disabled={!fm.copyright} onCommit={(v) => setInfo("edition", v)} />
              <TextAreaRow label="Epigraph" rows={3} value={fm.epigraph} onCommit={(v) => setBlock("frontMatter", { epigraph: v })} />
              <CheckRow label="Roman numerals" checked={fm.romanNumerals} onChange={(v) => setBlock("frontMatter", { romanNumerals: v })} />
            </div>
          </details>
          <details className={GROUP_DETAILS}>
            <summary className={GROUP_SUMMARY}>Back matter</summary>
            <div className={GROUP_BODY}>
              <TextAreaRow label="About the author" rows={3} value={bm.aboutAuthor} onCommit={(v) => setBlock("backMatter", { aboutAuthor: v })} />
              <CheckRow label="Colophon" checked={bm.colophon} onChange={(v) => setBlock("backMatter", { colophon: v })} />
            </div>
          </details>
          <details className={GROUP_DETAILS}>
            <summary className={GROUP_SUMMARY}>Scene ornament</summary>
            <div className={GROUP_BODY}>
              <Field label="Scene ornament">
                <Select value={b.sceneOrnament ?? "asterism"} onValueChange={(v) => set({ sceneOrnament: v as SceneOrnament })}>
                  <SelectTrigger aria-label="Scene ornament" className={SELECT_TRIGGER_CLS}><SelectValue /></SelectTrigger>
                  <SelectContent className={SELECT_POP_CLS}>
                    {BIND_SCENE_ORNAMENTS.map((s) => <SelectItem key={s} value={s} className={SELECT_ITEM_CLS}>{ORNAMENT_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </details>
          <p className="text-slate text-xs">Print at: {trimToPage(b.trim)} — check it in the dialog.</p>
          <p className="text-slate text-xs" data-testid="page-estimate">
            ≈ {estimatePageCount(manuscript)} páginas — estimativa por contagem de palavras; a paginação final só sai na impressão.
          </p>
          <p className="text-slate text-xs leading-relaxed" role="note" data-testid="print-hint">
            Cabeças de página e fólios aparecem apenas no diálogo de impressão — nunca na prévia na tela.
            Desmarque "Cabeçalhos e rodapés" ("Headers and footers") no diálogo, senão o navegador imprime números por cima do fólio.
            Imprima pelo Chrome ou Edge.
          </p>
        </aside>
        <div className="overflow-auto p-6 bg-ink" data-testid="bindery-preview">
          <style>{css}</style>
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
      {/* Print pass: the app shell (#root) stays on screen; the book prints from a
          body-level portal so print CSS can wipe everything else with #root. */}
      {printing
        ? createPortal(
            <>
              <style>{css}</style>
              <div
                className="print-book"
                data-testid="print-book"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

const PRINT_SETTLE_MS = 800;

/** Bindery index: every manuscript of the project + where it stands. */
export function BinderyIndex({ projectId }: { projectId: string }) {
  const manuscripts = useScriptorium(useShallow((s) => s.manuscripts.filter((m) => m.projectId === projectId)));

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="bindery-index">
      <header className={BOARD_HEADER}>
        <div className="grid gap-1">
          <h1 className="bl-title font-display text-[1.375rem] text-parchment-strong m-0">Publishing</h1>
          <p className="text-slate text-sm m-0">Trim the manuscript for export.</p>
        </div>
      </header>
      {manuscripts.length === 0 ? (
        <p className="text-slate text-[0.9375rem] mt-2">
          No manuscripts yet.{" "}
          <Link className="bindery-create-link text-lilac no-underline hover:underline" to={`/p/${projectId}/manuscript`}>Open the Manuscript forge</Link>{" "}
          to write one.
        </p>
      ) : (
        <ul className="bindery-list list-none m-0 p-0">
          {manuscripts.map((m) => (
            <li key={m.id}>
              <Link className="bindery-row flex items-baseline justify-between gap-4 px-1 py-3.5 border-t border-line text-inherit no-underline hover:[&_span]:text-gold [&:first-child>span]:border-t-0" to={`/p/${projectId}/bindery/${m.id}`}>
                <span className="bindery-row-title font-display text-[1.25rem] font-semibold text-parchment-strong">{m.title}</span>
                <span className="bindery-row-meta text-slate text-xs tracking-[0.06em] uppercase whitespace-nowrap">
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
