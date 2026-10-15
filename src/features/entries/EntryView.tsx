import { useEffect, useRef, useState, useCallback, type ChangeEvent, type MutableRefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import type { EntryCategory, WorldEntry, EntrySection } from "../../domain/types";
import { ENTRY_CATEGORIES } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { fileToDataUrl } from "../../data/image";
import { dateIsEmpty, formatDate, isValidDate, sanitizeDate } from "../../domain/dates";
import { LinkPicker } from "../atlas/panels/LinkPicker";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { CATEGORY_COLORS, CATEGORY_LABELS, categoryIcon } from "./categories";
import { ImagePicker } from "./ImagePicker";
import { MarkdownView } from "./MarkdownView";

export interface EntryViewProps {
  entry: WorldEntry;
  titleRef?: MutableRefObject<HTMLInputElement | null>;
  onDeleted(id: string): void;
  onSelectEntry?(id: string): void;
}

const CONFIRM_RESET_MS = 3000;

export function EntryView({ entry, titleRef, onDeleted, onSelectEntry }: EntryViewProps) {
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
  const cover = entry.imageKey ? images[entry.imageKey] : undefined;
  const entryDate = dateIsEmpty(entry.date ?? "") ? null : sanitizeDate(entry.date ?? "");
  const dateInvalid = !dateIsEmpty(dateDraft.draft) && !isValidDate(dateDraft.draft);

  return (
    <div className="codex-view">
      {cover ? (
        <img className="codex-cover" src={cover} alt={`Cover of ${entry.title}`} />
      ) : null}
      {entryDate ? <span className="codex-eyebrow">{formatDate(entryDate)}</span> : null}
      <div className="codex-view-head">
        <input
          ref={titleRef}
          type="text"
          className="codex-title-input"
          aria-label="Title"
          value={titleDraft.draft}
          onChange={(e) => titleDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
        <select
          className="codex-category"
          aria-label="Category"
          value={entry.category}
          onChange={(e) => {
            useScriptorium.getState().updateEntry(
              entry.id,
              { category: e.target.value as EntryCategory },
            );
          }}
        >
          {ENTRY_CATEGORIES.map((c) => (
            <option key={c} value={c}>{categoryIcon(c)} {CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="codex-summary-toggle"
        aria-expanded={summaryOpen}
        onClick={() => { flush(); setSummaryOpen((v) => !v); }}
      >
        <span>Summary</span>
        <span className="codex-summary-hint">{summaryDraft.draft.trim() || "Add a short blurb..."}</span>
        <span aria-hidden="true">{summaryOpen ? "▾" : "▸"}</span>
      </button>
      {summaryOpen ? (
        <textarea
          className="codex-summary-input"
          aria-label="Summary"
          placeholder="Add a short blurb..."
          value={summaryDraft.draft}
          onChange={(e) => summaryDraft.setDraft(e.target.value)}
          onBlur={flush}
          rows={2}
        />
      ) : null}
      <div className="codex-date-row">
        <input
          type="text"
          className="codex-date-input"
          aria-label="Date"
          placeholder="1200 · 1200-05 · 1200-05-10"
          value={dateDraft.draft}
          onChange={(e) => dateDraft.setDraft(e.target.value)}
          onBlur={dateDraft.flush}
        />
        {dateInvalid ? <p className="date-hint error">Invalid date.</p> : null}
      </div>
      <div className="codex-view-actions">
        <button
          type="button"
          className="codex-mode"
          aria-pressed={writing}
          onClick={() => setMode(true)}
        >
          Write
        </button>
        <button
          type="button"
          className="codex-mode"
          aria-pressed={!writing}
          onClick={() => setMode(false)}
        >
          Preview
        </button>
        <label className="codex-action">
          Change cover
          <input
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(e) => void onCoverChange(e)}
          />
        </label>
        <button
          type="button"
          className="codex-action"
          aria-pressed={imagePickerOpen}
          onClick={() => setImagePickerOpen((open) => !open)}
        >
          Entry image
        </button>
        {entry.imageKey ? (
          <button type="button" className="codex-action" onClick={clearCover}>
            Remove cover
          </button>
        ) : null}
      </div>
      {pickersOpen ? (
        <div className="chooser-backdrop" aria-hidden="true" onPointerDown={closePickers} />
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
        <div className="codex-sections">
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
            className="codex-section-add"
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
          className="codex-body"
          aria-label="Content"
          placeholder="No content yet."
          value={bodyDraft.draft}
          onChange={(e) => bodyDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
      ) : bodyDraft.draft.trim() === "" ? (
        <p className="codex-md-empty">No content yet.</p>
      ) : (
        <MarkdownView body={bodyDraft.draft} />
      )}
      <section className="codex-links" aria-label="Links">
        <span className="codex-links-title">Links</span>
        {entry.links.map((id) => {
          const other = siblings.find((e) => e.id === id);
          if (!other) return null;
          return (
            <span className="codex-link-chip" key={id}>
              <button
                type="button"
                className="codex-link-chip-main"
                onClick={() => onSelectEntry?.(id)}
              >
                <span
                  className="codex-dot"
                  aria-hidden="true"
                  style={{ backgroundColor: CATEGORY_COLORS[other.category] }}
                />
                <span className="codex-link-chip-title">{other.title}</span>
              </button>
              <button
                type="button"
                className="codex-link-unlink"
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
          className="codex-link-add"
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
      <div className="codex-view-actions">
        <button
          type="button"
          className={"codex-delete" + (armed ? " armed" : "")}
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
    <section className="codex-section" aria-label={sec.name}>
      <header className="codex-section-head">
        <input
          className="codex-section-name"
          aria-label={`Section ${sec.name}`}
          value={sec.name}
          onChange={(e) => onRename(e.target.value)}
        />
        <button type="button" className="codex-field-add" aria-label={`Add field to ${sec.name}`} onClick={onAddField}>+ field</button>
      </header>
      {sec.fields.length === 0 ? <p className="codex-field-empty">No fields.</p> : null}
      {sec.fields.map((f, fi) => (
        <div className="codex-field" key={fi}>
          <div className="codex-field-label-row">
            <span className="codex-field-label">{f.label}</span>
            <button
              type="button"
              className="codex-field-remove"
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
