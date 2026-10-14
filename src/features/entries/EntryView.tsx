import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { EntryCategory, WorldEntry } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { ENTRY_CATEGORIES } from "../../domain/types";
import { CATEGORY_LABELS } from "./categories";

export interface EntryViewProps {
  entry: WorldEntry;
  titleRef?: MutableRefObject<HTMLInputElement | null>;
  onDeleted(id: string): void;
}

const CONFIRM_RESET_MS = 3000;

export function EntryView({ entry, titleRef, onDeleted }: EntryViewProps) {
  const images = useScriptorium((s) => s.images);
  const cover = entry.imageKey ? images[entry.imageKey] : undefined;
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setArmed(false);
    window.clearTimeout(timerRef.current);
  }, [entry.id]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const update = (patch: Partial<Omit<WorldEntry, "id">>) => {
    useScriptorium.getState().updateEntry(entry.id, patch);
  };

  const confirmOrDelete = () => {
    if (armed) {
      setArmed(false);
      window.clearTimeout(timerRef.current);
      onDeleted(entry.id);
      return;
    }
    setArmed(true);
    timerRef.current = window.setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
  };

  return (
    <div className="codex-view">
      {cover ? (
        <img className="codex-cover" src={cover} alt={`Capa de ${entry.title}`} />
      ) : null}
      <div className="codex-view-head">
        <input
          ref={titleRef}
          type="text"
          className="codex-title-input"
          aria-label="Título"
          value={entry.title}
          onChange={(e) => update({ title: e.target.value })}
        />
        <select
          className="codex-category"
          aria-label="Categoria"
          value={entry.category}
          onChange={(e) => update({ category: e.target.value as EntryCategory })}
        >
          {ENTRY_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>
      <textarea
        className="codex-body"
        aria-label="Conteúdo"
        placeholder="Sem conteúdo ainda."
        value={entry.body}
        onChange={(e) => update({ body: e.target.value })}
      />
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
