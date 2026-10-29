import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import type { WorldEntry, EntrySection, EntrySectionField } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { fileToDataUrl } from "../../data/image";
import { newId } from "../../domain/id";
import { dateIsEmpty, formatDateWithCalendar, isValidDate, sanitizeDate } from "../../domain/dates";
import { LinkPicker } from "../atlas/panels/LinkPicker";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { categoryLabel, categoryDot, CODEX_CATEGORIES, CATEGORY_CANONICAL } from "./categories";
import { ImagePicker } from "./ImagePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownView } from "./MarkdownView";

export interface EntryViewProps {
  entry: WorldEntry;
  titleRef?: MutableRefObject<HTMLInputElement | null>;
  onDeleted(id: string): void;
  onSelectEntry?(id: string): void;
}

const CONFIRM_RESET_MS = 3000;

export function EntryView({ entry, titleRef, onDeleted, onSelectEntry }: EntryViewProps) {
  const { t } = useTranslation();
  const project = useScriptorium((s) => s.projects.find((p) => p.id === entry.projectId));
  const calendar = useScriptorium((s) => (s.calendars ?? []).find((c) => c.projectId === entry.projectId));
  const siblings = useScriptorium(
    useShallow((s) => s.entries.filter((e) => e.projectId === entry.projectId)),
  );
  const siblingById = useMemo(() => new Map(siblings.map((e) => [e.id, e] as const)), [siblings]);
  const [writing, setWriting] = useState(true);
  const [armed, setArmed] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const confirmTimerRef = useRef<number | undefined>(undefined);

  const commitTitle = useCallback((v: string) => {
    useScriptorium.getState().updateEntry(entry.id, { title: v });
  }, [entry.id]);
  const commitBody = useCallback((v: string) => {
    useScriptorium.getState().updateEntry(entry.id, { body: v });
  }, [entry.id]);
  const commitDate = useCallback((v: string) => {
    if (dateIsEmpty(v)) {
      useScriptorium.getState().updateEntry(entry.id, { date: undefined });
      return;
    }
    const clean = sanitizeDate(v);
    if (clean === null) return;
    useScriptorium.getState().updateEntry(entry.id, { date: clean });
  }, [entry.id]);
  const commitSummary = useCallback((v: string) => {
    useScriptorium.getState().updateEntry(entry.id, { summary: v });
  }, [entry.id]);
  const titleDraft = useDebouncedDraft(entry.title, commitTitle);
  const summaryDraft = useDebouncedDraft(entry.summary ?? "", commitSummary);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const bodyDraft = useDebouncedDraft(entry.body, commitBody);
  const dateDraft = useDebouncedDraft(entry.date ?? "", commitDate);

  // Flush the drafts that belong to the CURRENT entry id before switching to
  // another entry (or unmounting) — no lost keystroke.
  useEffect(() => {
    return () => {
      titleDraft.flush();
      bodyDraft.flush();
      dateDraft.flush();
      summaryDraft.flush();
    };
  }, [entry.id]);

  useEffect(() => {
    setArmed(false);
    setImagePickerOpen(false);
    setLinkPickerOpen(false);
    window.clearTimeout(confirmTimerRef.current);
  }, [entry.id]);

  useEffect(() => () => window.clearTimeout(confirmTimerRef.current), []);

  const pickersOpen = imagePickerOpen || linkPickerOpen;

  useEffect(() => {
    if (!pickersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setImagePickerOpen(false);
        setLinkPickerOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickersOpen]);

  const closePickers = () => {
    setImagePickerOpen(false);
    setLinkPickerOpen(false);
  };

  const pushToast = (kind: "success" | "error", message: string) => {
    useScriptorium.getState().pushToast(kind, message);
  };

  const flush = () => {
    titleDraft.flush();
    bodyDraft.flush();
    dateDraft.flush();
    summaryDraft.flush();
  };

  const confirmOrDelete = () => {
    if (armed) {
      setArmed(false);
      window.clearTimeout(confirmTimerRef.current);
      onDeleted(entry.id);
      return;
    }
    setArmed(true);
    confirmTimerRef.current = window.setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
  };

  const setMode = (next: boolean) => {
    flush();
    setWriting(next);
  };

  const onCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { dataUrl } = await fileToDataUrl(file);
      const ok = useScriptorium.getState().putEntryImage(entry.id, dataUrl);
      pushToast(ok ? "success" : "error", ok ? t("entries.view.coverUpdated") : t("entries.view.coverUpdateError"));
    } catch {
      pushToast("error", t("entries.view.coverLoadError"));
    }
  };

  const clearCover = () => {
    const oldKey = entry.imageKey;
    if (!oldKey) return;
    useScriptorium.getState().updateEntry(entry.id, { imageKey: undefined });
    if (!siblings.some((e) => e.id !== entry.id && e.imageKey === oldKey)) {
      useScriptorium.getState().removeImage(oldKey);
    }
  };

  // the picker filters entries that actually carry images (it subscribes to
  // the images map itself); the cover value is read narrowly per imageKey
  const coveredSiblings = siblings.filter((e) => e.id !== entry.id && e.imageKey !== undefined);
  const coverEl = useRef<HTMLImageElement | null>(null);
  const cover = useScriptorium((s) => (entry.imageKey ? s.images[entry.imageKey] : undefined));
  const entryDate = dateIsEmpty(entry.date ?? "") ? null : sanitizeDate(entry.date ?? "");
  const draftedDate = sanitizeDate(dateDraft.draft);
  const dateInvalid = !dateIsEmpty(dateDraft.draft) && (!isValidDate(dateDraft.draft) || draftedDate === null);
  const selectedCategory = CATEGORY_CANONICAL[entry.category] ?? entry.category;

  return (
    <div className="codex-view flex flex-col gap-3 max-w-[760px]">
      {cover ? (
        <img
          ref={coverEl}
          className="codex-cover w-full max-h-[220px] object-cover border border-line rounded-lg cursor-col-resize [touch-action:none]"
          src={cover}
          alt={t("entries.view.coverAlt", { title: entry.title })}
          draggable={false}
          style={entry.focal ? { objectPosition: `${entry.focal[0] * 100}% ${entry.focal[1] * 100}%` } : undefined}
          title={t("entries.view.dragReframe")}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            let pending = false;
            let raf = 0;
            const apply = (ev: PointerEvent) => {
              const r = coverEl.current?.getBoundingClientRect();
              if (!r || r.width === 0 || r.height === 0) return;
              const fx = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
              const fy = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
              pending = true;
              cancelAnimationFrame(raf);
              raf = requestAnimationFrame(() => {
                raf = 0;
                if (!pending) return;
                pending = false;
                useScriptorium.getState().updateEntry(entry.id, { focal: [fx, fy] });
              });
            };
            const up = () => {
              window.removeEventListener("pointermove", apply);
              window.removeEventListener("pointercancel", up);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", apply);
            window.addEventListener("pointercancel", up);
            window.addEventListener("pointerup", up);
          }}
        />
      ) : null}
      {entryDate ? <span className="codex-eyebrow text-gold-dim font-mono text-[11px] font-bold tracking-[0.08em] uppercase">{formatDateWithCalendar(entryDate, calendar)}</span> : null}
      <div className="flex items-baseline gap-2.5">
        <input
          ref={titleRef}
          type="text"
          className="codex-title-input flex-1 min-w-0 font-display text-[1.375rem] font-semibold text-parchment bg-none border border-transparent rounded-lg px-1.5 py-0.5 hover:border-line focus:border-gold outline-none"
          aria-label={t("entries.view.title")}
          value={titleDraft.draft}
          onChange={(e) => titleDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
        <Select value={selectedCategory} onValueChange={(v) => {
            useScriptorium.getState().updateEntry(entry.id, { category: v });
          }}>
          <SelectTrigger aria-label={t("entries.view.category")} className="rounded-lg border-line bg-night-2 text-parchment px-2 py-1.5 text-xs hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            {CODEX_CATEGORIES.map((c) => (
              <SelectItem key={c.key} value={c.key} className="text-xs focus:bg-accent focus:text-parchment">{c.icon} {categoryLabel(c.key)}</SelectItem>
            ))}
            {(project?.customCategories ?? []).map((k) => (
              <SelectItem key={k.key} value={k.key} className="text-xs focus:bg-accent focus:text-parchment">{k.icon} {k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <button
        type="button"
        className={"codex-summary-toggle grid grid-cols-[auto_1fr_auto] items-baseline gap-2.5 w-full text-left bg-night border border-line rounded-lg px-3 py-2 cursor-pointer text-parchment-dim hover:border-gold-dim" + (summaryDraft.draft.trim() ? " filled" : "") + (summaryOpen ? " rounded-bl-none rounded-br-none" : "")}
        aria-expanded={summaryOpen}
        onClick={() => { flush(); setSummaryOpen((v) => !v); }}
      >
        <span className="text-[10px] tracking-[0.12em] uppercase text-slate">{t("entries.view.summary")}</span>
        <span className={"codex-summary-hint text-slate overflow-hidden text-ellipsis whitespace-nowrap " + (summaryDraft.draft.trim() ? "text-parchment not-italic" : "italic")}>{summaryDraft.draft.trim() || t("entries.view.summaryPlaceholder")}</span>
        <span aria-hidden="true">{summaryOpen ? "▾" : "▸"}</span>
      </button>
      {summaryOpen ? (
        <textarea
          className="codex-summary-input w-full bg-night border border-line border-t-0 rounded-lg pt-2 px-3 pb-2 text-parchment resize-y outline-none focus:border-gold-dim max-[720px]:rounded-tl-none max-[720px]:rounded-tr-none"
          aria-label={t("entries.view.summary")}
          placeholder={t("entries.view.summaryPlaceholder")}
          value={summaryDraft.draft}
          onChange={(e) => summaryDraft.setDraft(e.target.value)}
          onBlur={flush}
          rows={2}
        />
      ) : null}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="codex-date-label text-[10px] tracking-[0.12em] uppercase text-slate">{t("entries.view.date")}</span>
        <input
          type="text"
          className="codex-date-input font-mono text-[13px] text-parchment bg-ink border border-line rounded-lg px-2.5 py-1.5 outline-none focus:border-gold placeholder:text-slate"
          aria-label={t("entries.view.date")}
          title={t("entries.view.dateHint")}
          placeholder="1200 · 1200-05 · 1200-05-10"
          value={dateDraft.draft}
          onChange={(e) => dateDraft.setDraft(e.target.value)}
          onBlur={dateDraft.flush}
        />
        {dateInvalid ? <p className="text-[var(--ember)] text-xs m-0">{t("entries.view.invalidDate")}</p> : null}
        {!dateInvalid && draftedDate ? (
          <span className="codex-date-formatted text-[11px] text-parchment-dim">
            {formatDateWithCalendar(draftedDate, calendar)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-end flex-wrap gap-2">
        <button
          type="button"
          className="codex-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
          aria-pressed={writing}
          onClick={() => setMode(true)}
        >
          {t("entries.view.write")}
        </button>
        <button
          type="button"
          className="codex-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
          aria-pressed={!writing}
          onClick={() => setMode(false)}
        >
          {t("entries.view.preview")}
        </button>
      </div>
      <section className="flex items-center flex-wrap gap-2 border-y border-line py-2" aria-label={t("entries.view.imageGroup")}>
        <div className="grid gap-0.5 mr-auto">
          <span className="text-[10px] tracking-[0.12em] uppercase text-slate">{t("entries.view.imageGroup")}</span>
          <span className="text-[11px] text-parchment-dim">{t("entries.view.imageHint")}</span>
        </div>
        <label className="codex-action bg-none border border-line text-parchment-dim rounded-lg py-1 px-2.5 text-xs cursor-pointer hover:border-gold-dim">
          {t("entries.view.changeCover")}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void onCoverChange(e)}
          />
        </label>
        <button
          type="button"
          className="codex-action bg-none border border-line text-parchment-dim rounded-lg py-1 px-2.5 text-xs cursor-pointer hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
          aria-pressed={imagePickerOpen}
          onClick={() => setImagePickerOpen((open) => !open)}
        >
          {t("entries.view.useImageFromEntry")}
        </button>
        {entry.imageKey ? (
          <button type="button" className="codex-action bg-none border border-line text-parchment-dim rounded-lg py-1 px-2.5 text-xs cursor-pointer hover:border-gold-dim" onClick={clearCover}>
            {t("entries.view.removeCover")}
          </button>
        ) : null}
      </section>
      {pickersOpen ? (
        <div className="chooser-backdrop fixed inset-0 z-29 bg-transparent" aria-hidden="true" onPointerDown={closePickers} />
      ) : null}
      {imagePickerOpen ? (
        <ImagePicker
          entries={coveredSiblings}
          onPick={(dataUrl) => {
            const ok = useScriptorium.getState().putEntryImage(entry.id, dataUrl);
            pushToast(ok ? "success" : "error", ok ? t("entries.view.coverUpdated") : t("entries.view.coverUpdateError"));
            setImagePickerOpen(false);
          }}
        />
      ) : null}
      {(entry.sections ?? []).length ? (
        <div className="grid gap-3">
          {(entry.sections ?? []).map((sec, si) => (
            <SectionBlock
              key={sec.id ?? si}
              sec={sec}
              onField={(field, content) => {
                // match by object reference: an onRemoveField shift can leave
                // captured indexes pointing at the wrong field
                const sections = (entry.sections ?? []).map((s) => s === sec
                  ? { ...s, fields: s.fields.map((f) => (f === field ? { ...f, content } : f)) }
                  : s);
                useScriptorium.getState().updateEntry(entry.id, { sections });
              }}
              onAddField={() => {
                const sections = (entry.sections ?? []).map((s) => s === sec
                  ? { ...s, fields: [...s.fields, { label: t("entries.view.newField"), content: "", id: newId("fld") }] }
                  : s);
                useScriptorium.getState().updateEntry(entry.id, { sections });
              }}
              onRenameField={(field, label) => {
                const sections = (entry.sections ?? []).map((s) => s === sec
                  ? { ...s, fields: s.fields.map((f) => (f === field ? { ...f, label } : f)) }
                  : s);
                useScriptorium.getState().updateEntry(entry.id, { sections });
              }}
              onRemoveField={(field) => {
                const sections = (entry.sections ?? []).map((s) => s === sec
                  ? { ...s, fields: s.fields.filter((f) => f !== field) }
                  : s);
                useScriptorium.getState().updateEntry(entry.id, { sections });
              }}
              onRename={(name) => {
                const sections = (entry.sections ?? []).map((s) => (s === sec ? { ...s, name } : s));
                useScriptorium.getState().updateEntry(entry.id, { sections });
              }}
            />
          ))}
          <button
            type="button"
            className="codex-section-add bg-none border border-line rounded-md text-slate cursor-pointer py-1 px-2.5 text-xs tracking-[0.04em] justify-self-start hover:text-parchment hover:border-gold-dim"
            aria-label={t("entries.view.newSection")}
            onClick={() => {
              const sections = [...(entry.sections ?? []), { name: t("entries.view.newSection"), fields: [], id: newId("sec") } satisfies EntrySection];
              useScriptorium.getState().updateEntry(entry.id, { sections });
            }}
          >
            {t("entries.view.addSection")}
          </button>
        </div>
      ) : null}
      {writing ? (
        <textarea
          className="codex-body min-h-[260px] resize-y bg-ink border border-line rounded-lg p-3 text-parchment font-mono text-[13px] leading-[1.6] outline-none focus:border-gold placeholder:text-slate"
          aria-label={t("entries.view.content")}
          placeholder={t("entries.view.contentPlaceholder")}
          value={bodyDraft.draft}
          onChange={(e) => bodyDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
      ) : bodyDraft.draft.trim() === "" ? (
        <p className="text-slate text-sm italic">{t("entries.view.noContent")}</p>
      ) : (
        <MarkdownView body={bodyDraft.draft} onSelectEntry={onSelectEntry} />
      )}
      <section className="flex items-center flex-wrap gap-1.5 border-t border-line pt-2.5" aria-label={t("entries.view.links")}>
        <span className="text-[11px] tracking-[0.08em] uppercase text-slate">{t("entries.view.links")}</span>
        {entry.links.map((id) => {
          const other = siblingById.get(id);
          if (!other) return null;
          return (
            <span className="codex-link-chip inline-flex items-center border border-line rounded-full bg-night-2 pt-px pr-px pl-0.5" key={id}>
              <button
                type="button"
                className="codex-link-chip-main inline-flex items-center gap-1.5 bg-none border-0 text-parchment py-[3px] pr-1 pl-2 text-xs cursor-pointer hover:text-gold"
                onClick={() => onSelectEntry?.(id)}
              >
                <span
                  className="codex-dot"
                  aria-hidden="true"
                  style={{ backgroundColor: categoryDot(other.category, project?.customCategories) }}
                />
                <span className="codex-link-chip-title max-w-40 overflow-hidden text-ellipsis whitespace-nowrap">{other.title}</span>
              </button>
              <button
                type="button"
                className="codex-link-unlink bg-none border-0 text-slate px-[7px] py-[3px] text-[11px] cursor-pointer hover:text-[var(--ember)]"
                aria-label={t("entries.view.unlink", { title: other.title })}
                onClick={() => useScriptorium.getState().unlinkEntries(entry.id, id)}
              >
                ✕
              </button>
            </span>
          );
        })}
        <button
          type="button"
          className="codex-link-add bg-none border border-line text-parchment-dim rounded-lg py-1 px-2.5 text-xs cursor-pointer hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
          aria-pressed={linkPickerOpen}
          onClick={() => setLinkPickerOpen((open) => !open)}
        >
          {t("entries.view.addLink")}
        </button>
        {linkPickerOpen ? (
          <LinkPicker
            entries={siblings.filter((e) => e.id !== entry.id)}
            onPick={(chosen) => {
              useScriptorium.getState().linkEntries(entry.id, chosen);
              setLinkPickerOpen(false);
            }}
            onClear={() => undefined}
          />
        ) : null}
      </section>
      <div className="flex items-center justify-end flex-wrap gap-2">
        <button
          type="button"
          className={"codex-delete bg-none border border-[var(--ember)] text-[var(--ember)] rounded-lg py-1.5 px-2.5 text-[13px] hover:bg-[color-mix(in_srgb,var(--ember)_18%,transparent)]" + (armed ? " armed bg-[color-mix(in_srgb,var(--ember)_20%,transparent)]" : "")}
          onClick={confirmOrDelete}
        >
          {armed ? t("entries.view.confirm") : t("entries.view.delete")}
        </button>
      </div>
    </div>
  );
}

function SectionBlock({ sec, onField, onAddField, onRemoveField, onRename, onRenameField }: {
  sec: EntrySection;
  onField(field: EntrySectionField, content: string): void;
  onAddField(): void;
  onRemoveField(field: EntrySectionField): void;
  onRename(name: string): void;
  onRenameField(field: EntrySectionField, label: string): void;
}) {
  const { t } = useTranslation();
  return (
    <section className="bg-night border border-line rounded-lg px-3.5 py-3 grid gap-2.5" aria-label={sec.name}>
      <header className="flex items-baseline gap-2">
        <input
          className="codex-section-name font-display text-[15px] font-semibold text-gold bg-none border border-transparent rounded-md px-1.5 py-0.5 flex-1 min-w-0 hover:border-line focus:border-gold-dim outline-none"
          aria-label={t("entries.view.section", { name: sec.name })}
          value={sec.name}
          onChange={(e) => onRename(e.target.value)}
        />
        <button type="button" className="codex-field-add bg-none border border-line rounded-md text-slate cursor-pointer py-1 px-2.5 text-xs tracking-[0.04em] hover:text-parchment hover:border-gold-dim" aria-label={t("entries.view.addFieldTo", { name: sec.name })} onClick={onAddField}>{t("entries.view.addField")}</button>
      </header>
      {sec.fields.length === 0 ? <p className="text-slate text-[13px] italic px-0.5 py-1">{t("entries.view.noFields")}</p> : null}
      {sec.fields.map((f, fi) => (
        <div className="codex-field-row grid gap-1 border-t border-line/70 pt-2" key={f.id ?? fi}>
          <div className="codex-field-label-row flex items-center gap-1.5 min-w-0">
            <input
              className="codex-field-label bg-none border border-transparent rounded-md text-[11px] uppercase tracking-[0.08em] text-slate px-0.5 min-w-0 flex-1 hover:border-line focus:border-gold-dim outline-none"
              aria-label={t("entries.view.fieldLabel", { label: f.label })}
              placeholder={t("entries.view.label")}
              value={f.label}
              onChange={(e) => onRenameField(f, e.target.value)}
            />
            <button
              type="button"
              className="codex-field-remove shrink-0 bg-none border-0 text-slate px-1.5 py-0.5 text-xs cursor-pointer hover:text-[var(--ember)]"
              aria-label={t("entries.view.removeField", { label: f.label })}
              onClick={() => onRemoveField(f)}
            >✕</button>
          </div>
          <SectionFieldInput label={f.label} value={f.content} onCommit={(content) => onField(f, content)} />
        </div>
      ))}
    </section>
  );
}

function SectionFieldInput({ label, value, onCommit }: { label: string; value: string; onCommit(v: string): void }) {
  const draft = useDebouncedDraft(value, onCommit, 300);
  const unmount = useRef(draft.flush);
  unmount.current = draft.flush;
  useEffect(() => () => unmount.current(), []);
  return (
    <input
      className="codex-field-value w-full bg-ink border border-line rounded-md px-2.5 py-1.5 text-[13px] text-parchment outline-none focus:border-gold-dim placeholder:text-slate"
      aria-label={label}
      value={draft.draft}
      onChange={(e) => draft.setDraft(e.target.value)}
      onBlur={() => draft.flush()}
    />
  );
}
