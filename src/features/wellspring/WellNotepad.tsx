import { useEffect, useState } from "react";

export function WellNotepad({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => {
    const id = setTimeout(() => { if (draft !== notes) onNotes(draft); }, 300);
    return () => clearTimeout(id);
  }, [draft, notes, onNotes]);
  return (
    <div className="absolute top-3.5 right-[320px] w-[260px] z-39 bg-night-2 border border-gold-dim rounded-lg shadow-[0_6px_18px_var(--scrim-canvas)]" data-testid="well-notepad">
      <header className="flex justify-between items-center px-2.5 py-1.5 cursor-move text-gold text-xs tracking-[0.1em] uppercase">
        <span>Notas</span>
        <button type="button" aria-label="Fechar notas" onClick={onClose}>✕</button>
      </header>
      <textarea aria-label="Notas da fonte" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
    </div>
  );
}
