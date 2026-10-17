import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Id, WorldEntry } from "../../../domain/types";

function LinkTarget({ entry }: { entry: WorldEntry }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="link-current self-start text-xs text-gold bg-none border-0 p-0 cursor-pointer text-left hover:underline"
      title="Open in codex"
      onClick={() => navigate(`/p/${entry.projectId}/entries?e=${entry.id}`)}
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
  // full scrollable list — capping at 8 hid most of the tome
  const matches = entries
    .filter((e) => e.id !== currentEntryId)
    .filter((e) => (q ? e.title.toLowerCase().includes(q) : true));
  return (
    <div className="link-picker flex flex-col gap-1.5 p-2 bg-ink border border-line rounded-lg">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tracking-[0.08em] uppercase text-slate">Link entry</span>
        {current ? (
          <button type="button" className="link-unlink bg-none border border-line rounded-lg text-parchment-dim px-2 py-0.5 hover:text-[var(--ember)] hover:border-[var(--ember)]" aria-label={`Unlink ${current.title}`} onClick={onClear}>
            ✕
          </button>
        ) : null}
      </div>
      {current ? <LinkTarget entry={current} /> : null}
      <input
        className="link-search w-full bg-ink text-parchment border border-line rounded-lg px-2.5 py-[7px] text-[13px] placeholder:text-slate outline-none focus-visible:border-gold-dim"
        type="text"
        aria-label="Search entries"
        placeholder="Search entries..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length === 0 ? (
        <p className="m-0 text-parchment-dim text-xs">No matching entries.</p>
      ) : (
        <ul className="link-list list-none m-0 p-0 flex flex-col gap-0.5 max-h-[220px] overflow-y-auto [&_button]:w-full [&_button]:text-left [&_button]:bg-none [&_button]:border-0 [&_button]:text-parchment [&_button]:py-1.5 [&_button]:px-2 [&_button]:rounded-lg [&_button]:text-[13px] hover:[&_button]:bg-night">
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
