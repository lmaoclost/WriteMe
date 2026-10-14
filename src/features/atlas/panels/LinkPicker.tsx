import { useState } from "react";
import type { Id, WorldEntry } from "../../../domain/types";
import "../atlas.css";

export const LINK_PICKER_MAX_ITEMS = 8;

export interface LinkPickerProps {
  entries: WorldEntry[];
  currentEntryId?: Id | null;
  onPick(entryId: Id): void;
  onClear(): void;
}

export function LinkPicker({ entries, currentEntryId, onPick, onClear }: LinkPickerProps) {
  const [query, setQuery] = useState("");
  const current = currentEntryId ? entries.find((e) => e.id === currentEntryId) : undefined;
  const q = query.trim().toLowerCase();
  const matches = entries
    .filter((e) => e.id !== currentEntryId)
    .filter((e) => (q ? e.title.toLowerCase().includes(q) : true))
    .slice(0, LINK_PICKER_MAX_ITEMS);
  return (
    <div className="link-picker">
      <div className="link-picker-head">
        <span className="link-picker-title">Vincular entrada</span>
        {current ? (
          <button type="button" className="link-unlink" aria-label="Remover vínculo" onClick={onClear}>
            ✕
          </button>
        ) : null}
      </div>
      {current ? <div className="link-current">{current.title}</div> : null}
      <input
        className="link-search"
        type="text"
        aria-label="Buscar entrada"
        placeholder="Buscar entrada…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length === 0 ? (
        <p className="link-empty">Nenhum resultado</p>
      ) : (
        <ul className="link-list">
          {matches.map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => onPick(entry.id)}>
                {entry.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}