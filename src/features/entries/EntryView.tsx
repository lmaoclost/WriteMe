import { useEffect, useRef, useState, useCallback, type ChangeEvent, type MutableRefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import type { EntryCategory, WorldEntry } from "../../domain/types";
import { ENTRY_CATEGORIES } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { fileToDataUrl } from "../../data/image";
import { dateIsEmpty, formatDate, sanitizeDate } from "../../domain/dates";
import { LinkPicker } from "../atlas/panels/LinkPicker";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "./categories";
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
  const titleDraft = useDebouncedDraft(entry.title, commitTitle);
  const bodyDraft = useDebouncedDraft(entry.body, commitBody);
  const dateDraft = useDebouncedDraft(entry.date ?? "", commitDate);

  // Flush the drafts that belong to the CURRENT entry id before switching to
  // another entry (or unmounting) — no lost keystroke.
  useEffect(() => {
    return () => {
      titleDraft.flush();
      bodyDraft.flush();
      dateDraft.flush();
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
      pushToast(ok ? "success" : "error", ok ? "Capa atualizada." : "Não foi possível atualizar a capa.");
    } catch {
      pushToast("error", "Não foi possível carregar a capa.");
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
  const dateInvalid = !dateIsEmpty(dateDraft.draft) && sanitizeDate(dateDraft.draft) === null;

  return (
    <div className="codex-view">
      {cover ? (
        <img className="codex-cover" src={cover} alt={`Capa de ${entry.title}`} />
      ) : null}
      {entryDate ? <span className="codex-eyebrow">{formatDate(entryDate)}</span> : null}
      <div className="codex-view-head">
        <input
          ref={titleRef}
          type="text"
          className="codex-title-input"
          aria-label="Título"
          value={titleDraft.draft}
          onChange={(e) => titleDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
        <select
          className="codex-category"
          aria-label="Categoria"
          value={entry.category}
          onChange={(e) => {
            useScriptorium.getState().updateEntry(
              entry.id,
              { category: e.target.value as EntryCategory },
            );
          }}
        >
          {ENTRY_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>
      <div className="codex-date-row">
        <input
          type="text"
          className="codex-date-input"
          aria-label="Data"
          placeholder="1200 · 1200-05 · 1200-05-10"
          value={dateDraft.draft}
          onChange={(e) => dateDraft.setDraft(e.target.value)}
          onBlur={dateDraft.flush}
        />
        {dateInvalid ? <p className="date-hint error">Data inválida.</p> : null}
      </div>
      <div className="codex-view-actions">
        <button
          type="button"
          className="codex-mode"
          aria-pressed={writing}
          onClick={() => setMode(true)}
        >
          Escrever
        </button>
        <button
          type="button"
          className="codex-mode"
          aria-pressed={!writing}
          onClick={() => setMode(false)}
        >
          Prévia
        </button>
        <label className="codex-action">
          Trocar capa
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
          Imagem do códex
        </button>
        {entry.imageKey ? (
          <button type="button" className="codex-action" onClick={clearCover}>
            Remover capa
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
            pushToast(ok ? "success" : "error", ok ? "Capa atualizada." : "Não foi possível atualizar a capa.");
            setImagePickerOpen(false);
          }}
        />
      ) : null}
      {writing ? (
        <textarea
          className="codex-body"
          aria-label="Conteúdo"
          placeholder="Sem conteúdo ainda."
          value={bodyDraft.draft}
          onChange={(e) => bodyDraft.setDraft(e.target.value)}
          onBlur={flush}
        />
      ) : bodyDraft.draft.trim() === "" ? (
        <p className="codex-md-empty">Sem conteúdo ainda.</p>
      ) : (
        <MarkdownView body={bodyDraft.draft} />
      )}
      <section className="codex-links" aria-label="Vínculos">
        <span className="codex-links-title">Vínculos</span>
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
                aria-label={`Remover vínculo com ${other.title}`}
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
          + Vínculo
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
          {armed ? "Confirmar?" : "Excluir"}
        </button>
      </div>
    </div>
  );
}
