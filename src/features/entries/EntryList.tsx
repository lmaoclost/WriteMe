import { useState } from "react";
import type { WorldEntry, EntryCategory } from "../../domain/types";
import { CATEGORY_COLORS, CODEX_CATEGORY_CHIPS, CATEGORY_CANONICAL } from "./categories";

export interface EntryListProps {
  entries: WorldEntry[];
  selectedId: string | null;
  onSelect(id: string): void;
  onCreate(): void;
}

export function EntryList({ entries, selectedId, onSelect, onCreate }: EntryListProps) {
  const [chip, setChip] = useState<EntryCategory | null>(null);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const canonical = (c: string) => CATEGORY_CANONICAL[c] ?? c;
  const filtered = entries.filter((e) =>
    (chip === null || canonical(e.category) === chip)
    && (needle === "" || e.title.toLowerCase().includes(needle)));

  return (
    <aside className="codex-list">
      <div className="codex-top">
        <button type="button" className="btn-primary codex-new" onClick={onCreate}>
          New entry
        </button>
        <input
          type="text"
          className="codex-search"
          aria-label="Search entries"
          placeholder="Search entries..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="codex-chips codex-chips-codex" role="group" aria-label="Filter by category">
        {CODEX_CATEGORY_CHIPS.map((c) => (
          <button
            type="button"
            key={c.label}
            aria-pressed={chip === c.value}
            onClick={() => setChip(c.value)}
            title={c.label}
          >
            <span aria-hidden="true">{c.icon}</span>
            <span className="codex-chip-label">{c.label}</span>
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <p className="codex-empty">The codex is empty — register the first entry.</p>
      ) : filtered.length === 0 ? (
        <p className="codex-empty">Nenhum resultado.</p>
      ) : (
        <ul className="codex-rows">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={"codex-row" + (e.id === selectedId ? " active" : "")}
                onClick={() => onSelect(e.id)}
              >
                <span
                  className="codex-dot"
                  aria-hidden="true"
                  style={{ backgroundColor: CATEGORY_COLORS[e.category] }}
                />
                <span className="codex-row-title">{e.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
