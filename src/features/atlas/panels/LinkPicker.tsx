import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Id, WorldEntry } from "../../../domain/types";
import "../atlas.css";

export const LINK_PICKER_MAX_ITEMS = 8;

function LinkTarget({ entry }: { entry: WorldEntry }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="link-current"
      title="Open in codex"
      onClick={() => navigate("../entries", { state: { select: entry.id } })}
    >
      {entry.title}
    </button>
  );
}

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
        <span className="link-picker-title">Link entry</span>
        {current ? (
          <button type="button" className="link-unlink" aria-label="Unlink " onClick={onClear}>
            ✕
          </button>
        ) : null}
      </div>
      {current ? <LinkTarget entry={current} /> : null}
      <input
        className="link-search"
        type="text"
        aria-label="Search entries"
        placeholder="Buscar entrada…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length === 0 ? (
        <p className="link-empty">No matching entries.</p>
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
