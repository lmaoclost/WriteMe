import { useState } from "react";
import type { WorldEntry, EntryCategory } from "../../domain/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "./categories";

export interface EntryListProps {
  entries: WorldEntry[];
  selectedId: string | null;
  onSelect(id: string): void;
  onCreate(): void;
}

interface Chip {
  value: EntryCategory | null;
  label: string;
}

const CHIPS: Chip[] = [
  { value: null, label: "Todas" },
  ...(["person", "place", "faction", "event", "item", "lore"] as EntryCategory[])
    .map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
];

export function EntryList({ entries, selectedId, onSelect, onCreate }: EntryListProps) {
  const [chip, setChip] = useState<EntryCategory | null>(null);
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const filtered = entries.filter((e) =>
    (chip === null || e.category === chip)
    && (needle === "" || e.title.toLowerCase().includes(needle)));

  return (
    <aside className="codex-list">
      <div className="codex-top">
        <button type="button" className="btn-primary codex-new" onClick={onCreate}>
          Nova entrada
        </button>
        <input
          type="text"
          className="codex-search"
          aria-label="Buscar entrada…"
          placeholder="Buscar entrada…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="codex-chips" role="group" aria-label="Filtrar por categoria">
        {CHIPS.map((c) => (
          <button
            type="button"
            key={c.label}
            aria-pressed={chip === c.value}
            onClick={() => setChip(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <p className="codex-empty">O códex está vazio — registre a primeira entrada.</p>
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
