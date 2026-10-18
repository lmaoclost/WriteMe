import { useEffect } from "react";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";

export function WellNotepad({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  // debounced draft that flushes on unmount: closing the notepad must not
  // drop the pending <=300ms commit (the old local timer did exactly that)
  const { draft, setDraft, flush } = useDebouncedDraft(notes, onNotes);
  useEffect(() => () => flush(), [flush]);

  return (
    <div className="absolute top-3.5 right-[320px] w-[260px] z-39 bg-night-2 border border-gold-dim rounded-lg shadow-[0_6px_18px_var(--scrim-canvas)]" data-testid="well-notepad">
      <header className="flex justify-between items-center px-2.5 py-1.5 cursor-move text-gold text-xs tracking-[0.1em] uppercase">
        <span>Notas</span>
        <button type="button" aria-label="Fechar notas" onClick={() => { flush(); onClose(); }}>✕</button>
      </header>
      <textarea aria-label="Notas da fonte" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
    </div>
  );
}
