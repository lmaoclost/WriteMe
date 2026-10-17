import { useState } from "react";
import type { WorldEntry, EntryCategory } from "../../domain/types";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { CODEX_CATEGORY_CHIPS, CATEGORY_CANONICAL, categoryDot } from "./categories";
import { Button } from "../../ui/Button";
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
    <aside className="codex-list flex flex-col gap-2.5 min-h-0 p-3 bg-night border-r border-line max-[720px]:border-r-0 max-[720px]:border-b max-[720px]:border-line">
      <div className="flex flex-col gap-2">
        <Button className="codex-new self-start" onClick={onCreate}>
          New entry
        </Button>
        {onCreateKind ? (
          <button type="button" className="codex-kind-add bg-none border border-line rounded-md text-slate cursor-pointer py-1 px-2.5 text-xs tracking-[0.04em] self-start hover:text-gold hover:border-gold-dim" onClick={onCreateKind}>+ New kind</button>
        ) : null}
        <input
          type="text"
          className="codex-search w-full bg-ink text-parchment border border-line rounded-lg px-2.5 py-[7px] text-[13px] placeholder:text-slate outline-none focus-visible:border-gold-dim"
          aria-label="Search entries"
          placeholder="Search entries..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="codex-chips codex-chips-codex flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
        {CODEX_CATEGORY_CHIPS.map((c) => (
          <button
            type="button"
            key={c.label}
            aria-pressed={chip === c.value}
            onClick={() => setChip(c.value)}
            title={c.label}
            className="bg-none border border-line text-parchment-dim rounded-full py-[3px] px-2.5 text-[11px] tracking-[0.06em] uppercase hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
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
            className="bg-none border border-line text-parchment-dim rounded-full py-[3px] px-2.5 text-[11px] tracking-[0.06em] uppercase hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
          >
            <span aria-hidden="true">{k.icon}</span>
            <span className="codex-chip-label">{k.label}</span>
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <p className="codex-empty text-parchment-dim text-[13px] mx-0.5 my-2">The codex is empty — register the first entry.</p>
      ) : filtered.length === 0 ? (
        <p className="codex-empty text-parchment-dim text-[13px] mx-0.5 my-2">Nenhum resultado.</p>
      ) : (
        <ul className="codex-rows list-none m-0 p-0.5 flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={"codex-row flex items-center gap-2 w-full text-left bg-none border-0 border-l-2 border-transparent rounded-lg text-parchment px-2.5 py-2 text-sm hover:bg-night-2" + (e.id === selectedId ? " active border-l-gold bg-night-2" : "")}
                onClick={() => onSelect(e.id)}
              >
                <span
                  className="codex-dot size-2.5 rounded-full flex-none"
                  aria-hidden="true"
                  style={{ backgroundColor: categoryDot(e.category, customKinds) }}
                />
                <span className="codex-row-title overflow-hidden text-ellipsis whitespace-nowrap">{e.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
