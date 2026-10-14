import { useEffect, useState } from "react";
import type { BloodlinePerson } from "../../domain/types";

export function FindBar({ persons, onPick, onClose }: {
  persons: BloodlinePerson[];
  onPick(id: string): void;
  onClose(): void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const q = query.trim().toLowerCase();
  const matches = persons.filter((p) => {
    if (!q) return false;
    const haystack = [p.name, p.suffix, p.title, p.badgeText, ...p.additionalTitles.map((t) => t.title)]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q);
  }).slice(0, 50);
  return (
    <div className="find-bar" role="dialog" aria-label="Buscar pessoas" data-testid="find-bar">
      <input
        autoFocus
        aria-label="Buscar"
        placeholder="Nome, sufixo, título…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="find-results">
        {matches.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p.id)}>{p.name}</button>
          </li>
        ))}
      </ul>
      {!q ? <p className="find-hint">Digite para buscar.</p> : null}
      {q && matches.length === 0 ? <p className="find-hint">Nenhum resultado.</p> : null}
    </div>
  );
}
