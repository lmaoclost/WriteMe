import { useEffect, useState } from "react";

export function BoardNotepad({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  const [draft, setDraft] = useState(notes);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x?: number; y?: number }>({});
  useEffect(() => {
    const id = setTimeout(() => { if (draft !== notes) onNotes(draft); }, 300);
    return () => clearTimeout(id);
  }, [draft, notes, onNotes]);
  return (
    <div className="bl-notepad" data-testid="board-notepad"
      style={pos.x != null ? { position: "fixed", left: pos.x, top: pos.y, right: "auto" } : undefined}>
      <header className="bl-notepad-head"
        onPointerDown={(e) => { if (e.button === 0) setDrag({ dx: e.clientX, dy: e.clientY }); }}
        onPointerMove={(e) => { if (drag) setPos({ x: e.clientX - drag.dx, y: e.clientY - drag.dy }); }}
        onPointerUp={() => setDrag(null)}>
        <span>Notas</span>
        <button type="button" aria-label="Fechar notas" onClick={onClose}>✕</button>
      </header>
      <textarea aria-label="Notas do plano" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
    </div>
  );
}
