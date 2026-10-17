import { useEffect, useRef, useState, useCallback, type ChangeEvent, type MutableRefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import type { WorldEntry, EntrySection } from "../../domain/types";
import { ENTRY_CATEGORIES } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { fileToDataUrl } from "../../data/image";
import { dateIsEmpty, formatDate, isValidDate, sanitizeDate } from "../../domain/dates";
import { LinkPicker } from "../atlas/panels/LinkPicker";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { CATEGORY_LABELS, categoryIcon, categoryDot } from "./categories";
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
  const project = useScriptorium((s) => s.projects.find((p) => p.id === entry.projectId));
  const images = useScriptorium((s) => s.images);
  const siblings = useScriptorium(
    useShallow((s) => s.entries.filter((e) => e.projectId === entry.projectId)),
  );
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
      pushToast(ok ? "success" : "error", ok ? "Cover updated." : "Couldn't update the cover.");
    } catch {
      pushToast("error", "Couldn't load the cover.");
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

  const coveredSiblings = siblings.filter(
    (e) => e.id !== entry.id && e.imageKey !== undefined && images[e.imageKey] !== undefined,
  );
  const coverEl = useRef<HTMLImageElement | null>(null);
  const cover = entry.imageKey ? images[entry.imageKey] : undefined;
  const entryDate = dateIsEmpty(entry.date ?? "") ? null : sanitizeDate(entry.date ?? "");
  const dateInvalid = !dateIsEmpty(dateDraft.draft) && !isValidDate(dateDraft.draft);

  return (
    <div className="codex-view flex flex-col gap-3 max-w-[760px]">
      {cover ? (
        <img
          ref={coverEl}
          className="codex-cover w-full max-h-[220px] object-cover border border-line rounded-lg cursor-col-resize [touch-action:none]"
          src={cover}
          alt={`Cover of ${entry.title}`}
          draggable={false}
          style={entry.focal ? { objectPosition: `${entry.focal[0] * 100}% ${entry.focal[1] * 100}%` } : undefined}
          title="Drag to reframe"
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
      {entryDate ? <span className="codex-eyebrow text-gold-dim font-mono text-[11px] font-bold tracking-[0.08em] uppercase">{formatDate(entryDate)}</span> : null}
      <div className="flex items-baseline gap-2.5">
        <input
          ref={titleRef}
          type="text"
          className="codex-title-input flex-1 min-w-0 font-display text-[1.375rem] font-semibold text-parchment bg-none border border-transparent rounded-lg px-1.5 py-0.5 hover:border-line focus:border-gold outline-none"
          aria-label="Title"
          value={titleDraft.draft}
          onChange={(e) => titleDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
        <Select value={entry.category} onValueChange={(v) => {
            useScriptorium.getState().updateEntry(entry.id, { category: v });
          }}>
          <SelectTrigger aria-label="Category" className="rounded-lg border-line bg-night-2 text-parchment px-2 py-1.5 text-xs hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            {ENTRY_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="text-xs focus:bg-[#24233f] focus:text-parchment">{categoryIcon(c)} {CATEGORY_LABELS[c]}</SelectItem>
            ))}
            {(project?.customCategories ?? []).map((k) => (
              <SelectItem key={k.key} value={k.key} className="text-xs focus:bg-[#24233f] focus:text-parchment">{k.icon} {k.label}</SelectItem>
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
        <span className="text-[10px] tracking-[0.12em] uppercase text-slate">Summary</span>
        <span className={"codex-summary-hint text-slate overflow-hidden text-ellipsis whitespace-nowrap " + (summaryDraft.draft.trim() ? "text-parchment not-italic" : "italic")}>{summaryDraft.draft.trim() || "Add a short blurb..."}</span>
        <span aria-hidden="true">{summaryOpen ? "▾" : "▸"}</span>
      </button>
      {summaryOpen ? (
        <textarea
          className="codex-summary-input w-full bg-night border border-line border-t-0 rounded-lg pt-2 px-3 pb-2 text-parchment resize-y outline-none focus:border-gold-dim max-[720px]:rounded-tl-none max-[720px]:rounded-tr-none"
          aria-label="Summary"
          placeholder="Add a short blurb..."
          value={summaryDraft.draft}
          onChange={(e) => summaryDraft.setDraft(e.target.value)}
          onBlur={flush}
          rows={2}
        />
      ) : null}
      <div className="flex items-center gap-2.5 flex-wrap">
        <input
          type="text"
          className="codex-date-input font-mono text-[13px] text-parchment bg-ink border border-line rounded-lg px-2.5 py-1.5 outline-none focus:border-gold placeholder:text-slate"
          aria-label="Date"
          placeholder="1200 · 1200-05 · 1200-05-10"
          value={dateDraft.draft}
          onChange={(e) => dateDraft.setDraft(e.target.value)}
          onBlur={dateDraft.flush}
        />
        {dateInvalid ? <p className="text-[var(--ember)] text-xs m-0">Invalid date.</p> : null}
      </div>
      <div className="flex items-center justify-end flex-wrap gap-2">
        <button
          type="button"
          className="codex-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
          aria-pressed={writing}
          onClick={() => setMode(true)}
        >
          Write
        </button>
        <button
          type="button"
          className="codex-mode bg-none border border-line text-parchment-dim rounded-full px-3 py-1 text-xs tracking-[0.06em] hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
          aria-pressed={!writing}
          onClick={() => setMode(false)}
        >
          Preview
        </button>
        <label className="codex-action bg-none border border-line text-parchment-dim rounded-lg py-1 px-2.5 text-xs cursor-pointer hover:border-gold-dim">
          Change cover
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
          Entry image
        </button>
        {entry.imageKey ? (
          <button type="button" className="codex-action bg-none border border-line text-parchment-dim rounded-lg py-1 px-2.5 text-xs cursor-pointer hover:border-gold-dim" onClick={clearCover}>
            Remove cover
          </button>
        ) : null}
      </div>
      {pickersOpen ? (
        <div className="chooser-backdrop fixed inset-0 z-29 bg-transparent" aria-hidden="true" onPointerDown={closePickers} />
      ) : null}
      {imagePickerOpen ? (
        <ImagePicker
          images={images}
          entries={coveredSiblings}
          onPick={(dataUrl) => {
            const ok = useScriptorium.getState().putEntryImage(entry.id, dataUrl);
            pushToast(ok ? "success" : "error", ok ? "Cover updated." : "Couldn't update the cover.");
            setImagePickerOpen(false);
          }}
        />
      ) : null}
      {(entry.sections ?? []).length ? (
        <div className="grid gap-3">
          {(entry.sections ?? []).map((sec, si) => (
            <SectionBlock
              key={si}
              sec={sec}
              onField={(fi, content) => {
                const sections = (entry.sections ?? []).map((s, j) => j === si
                  ? { ...s, fields: s.fields.map((f, k) => (k === fi ? { ...f, content } : f)) }
                  : s);
                useScriptorium.getState().updateEntry(entry.id, { sections });
              }}
              onAddField={() => {
                const sections = (entry.sections ?? []).map((s, j) => j === si
                  ? { ...s, fields: [...s.fields, { label: "New Field", content: "" }] }
                  : s);
                useScriptorium.getState().updateEntry(entry.id, { sections });
              }}
              onRemoveField={(fi) => {
                const sections = (entry.sections ?? []).map((s, j) => j === si
                  ? { ...s, fields: s.fields.filter((_f, k) => k !== fi) }
                  : s);
                useScriptorium.getState().updateEntry(entry.id, { sections });
              }}
              onRename={(name) => {
                const sections = (entry.sections ?? []).map((s, j) => (j === si ? { ...s, name } : s));
                useScriptorium.getState().updateEntry(entry.id, { sections });
              }}
            />
          ))}
          <button
            type="button"
            className="codex-section-add bg-none border border-line rounded-md text-slate cursor-pointer py-1 px-2.5 text-xs tracking-[0.04em] justify-self-start hover:text-parchment hover:border-gold-dim"
            aria-label="New section"
            onClick={() => {
              const sections = [...(entry.sections ?? []), { name: "New section", fields: [] } satisfies EntrySection];
              useScriptorium.getState().updateEntry(entry.id, { sections });
            }}
          >
            + Section
          </button>
        </div>
      ) : null}
      {writing ? (
        <textarea
          className="codex-body min-h-[260px] resize-y bg-ink border border-line rounded-lg p-3 text-parchment font-mono text-[13px] leading-[1.6] outline-none focus:border-gold placeholder:text-slate"
          aria-label="Content"
          placeholder="No content yet."
          value={bodyDraft.draft}
          onChange={(e) => bodyDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
      ) : bodyDraft.draft.trim() === "" ? (
        <p className="text-slate text-sm italic">No content yet.</p>
      ) : (
        <MarkdownView body={bodyDraft.draft} onSelectEntry={onSelectEntry} />
      )}
      <section className="flex items-center flex-wrap gap-1.5 border-t border-line pt-2.5" aria-label="Links">
        <span className="text-[11px] tracking-[0.08em] uppercase text-slate">Links</span>
        {entry.links.map((id) => {
          const other = siblings.find((e) => e.id === id);
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
                aria-label={`Unlink ${other.title}`}
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
          + Link
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
          {armed ? "Confirm?" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function SectionBlock({ sec, onField, onAddField, onRemoveField, onRename }: {
  sec: EntrySection;
  onField(fi: number, content: string): void;
  onAddField(): void;
  onRemoveField(fi: number): void;
  onRename(name: string): void;
}) {
  return (
    <section className="bg-night border border-line rounded-lg px-3.5 py-3 grid gap-2.5" aria-label={sec.name}>
      <header className="flex items-baseline gap-2">
        <input
          className="codex-section-name font-display text-[15px] font-semibold text-gold bg-none border border-transparent rounded-md px-1.5 py-0.5 flex-1 min-w-0 hover:border-line focus:border-gold-dim outline-none"
          aria-label={`Section ${sec.name}`}
          value={sec.name}
          onChange={(e) => onRename(e.target.value)}
        />
        <button type="button" className="codex-field-add bg-none border border-line rounded-md text-slate cursor-pointer py-1 px-2.5 text-xs tracking-[0.04em] hover:text-parchment hover:border-gold-dim" aria-label={`Add field to ${sec.name}`} onClick={onAddField}>+ field</button>
      </header>
      {sec.fields.length === 0 ? <p className="text-slate text-[13px] italic px-0.5 py-1">No fields.</p> : null}
      {sec.fields.map((f, fi) => (
        <div className="grid grid-cols-[130px_1fr_auto] gap-1.5 items-start" key={fi}>
          <div className="codex-field-label-row min-w-0 pt-[7px]">
            <span className="codex-field-label text-[11px] uppercase tracking-[0.08em] text-slate px-0.5 min-w-0">{f.label}</span>
            <button
              type="button"
              className="codex-field-remove bg-none border-0 text-slate px-1.5 py-0.5 text-xs cursor-pointer hover:text-[var(--ember)]"
              aria-label={`Remove field ${f.label}`}
              onClick={() => onRemoveField(fi)}
            >✕</button>
          </div>
          <SectionFieldInput label={f.label} value={f.content} onCommit={(content) => onField(fi, content)} />
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
      aria-label={label}
      value={draft.draft}
      onChange={(e) => draft.setDraft(e.target.value)}
      onBlur={() => draft.flush()}
    />
  );
}
