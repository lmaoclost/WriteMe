import { useEffect, useState } from "react";

export const OATHS_NOTEPAD = true as const;

export function OathsNotepad({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => {
    const id = setTimeout(() => { if (draft !== notes) onNotes(draft); }, 300);
    return () => clearTimeout(id);
  }, [draft, notes, onNotes]);
  return (
    <div className="bl-notepad" data-testid="oaths-notepad">
      <header className="bl-notepad-head">
        <span>Notas</span>
        <button type="button" aria-label="Fechar notas" onClick={onClose}>✕</button>
      </header>
      <textarea aria-label="Notas da hierarquia" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
    </div>
  );
}
