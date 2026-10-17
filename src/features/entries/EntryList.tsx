import { useState } from "react";
import type { WorldEntry, EntryCategory } from "../../domain/types";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { CODEX_CATEGORY_CHIPS, CATEGORY_CANONICAL, categoryDot } from "./categories";
import type { EntryKind } from "../../domain/types";

const NO_KINDS: EntryKind[] = [];

export interface EntryListProps {
  entries: WorldEntry[];
  selectedId: string | null;
  onSelect(id: string): void;
  onCreate(): void;
  onCreateKind?(): void;
}

export function EntryList({ entries, selectedId, onSelect, onCreate, onCreateKind }: EntryListProps) {
  const [chip, setChip] = useState<EntryCategory | string | null>(null);
  const [query, setQuery] = useState("");
  const customKinds = useScriptorium(useShallow((s) =>
    s.projects.find((p) => p.id === entries[0]?.projectId)?.customCategories ?? NO_KINDS));

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
        {onCreateKind ? (
          <button type="button" className="codex-kind-add" onClick={onCreateKind}>+ New kind</button>
        ) : null}
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
        {customKinds.map((k) => (
          <button
            type="button"
            key={k.key}
            aria-pressed={chip === k.key}
            onClick={() => setChip(k.key)}
            title={k.label}
          >
            <span aria-hidden="true">{k.icon}</span>
            <span className="codex-chip-label">{k.label}</span>
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
                  style={{ backgroundColor: categoryDot(e.category, customKinds) }}
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
