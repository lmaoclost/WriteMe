import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { BINDERY_FONTS, BINDERY_TRIMS, estimatePageCount, trimToPage } from "./bindery";
import { buildBookCss } from "./bookCss";
import { ExportButtons } from "./Export";
import { BIND_HEAD_MODES } from "../../data/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../ui/Field";
import { BOARD_HEADER, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_PANEL } from "../../ui/board";
import { buildBookHtml } from "./buildBook";

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
    () => manuscript?.bindery ?? {
      font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true, titlePage: true, toc: true, glossary: false,
    },
    [manuscript],
  );
  const set = (patch: Partial<NonNullable<typeof b>>) => useScriptorium.getState().setBindery(manuscriptId, patch);
  const html = useMemo(() => (manuscript ? buildBookHtml(manuscript) : ""), [manuscript]);
  const css = useMemo(
    () => (manuscript ? buildBookCss(b, {
      chapters: manuscript.chapters.map((c) => ({ heading: c.heading, partId: c.partId })),
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
          <p className="text-slate text-xs">Print at: {trimToPage(b.trim)} — check it in the dialog.</p>
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
