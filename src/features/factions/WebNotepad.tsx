import { useEffect, useState } from "react";

export function WebNotepad({ notes, onNotes, onClose }: {
  notes: string;
  onNotes(v: string): void;
  onClose(): void;
}) {
  const [draft, setDraft] = useState(notes);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<{ x?: number; y?: number }>({});
  useEffect(() => {
    const id = setTimeout(() => { if (draft !== notes) onNotes(draft); }, 300);
    return () => clearTimeout(id);
  }, [draft, notes, onNotes]);
  return (
    <div
      className="absolute top-3.5 left-auto w-[260px] z-39 bg-night-2 border border-gold-dim rounded-lg shadow-[0_6px_18px_var(--scrim-canvas)]"
      data-testid="web-notepad"
      style={pos.x != null ? { position: "fixed", left: pos.x, top: pos.y, right: "auto" } : undefined}>
      <header className="flex justify-between items-center px-2.5 py-1.5 cursor-move text-gold text-xs tracking-[0.1em] uppercase"
        onPointerDown={(e) => { if (e.button === 0) setDrag({ dx: e.clientX, dy: e.clientY }); }}
        onPointerMove={(e) => { if (drag) setPos({ x: e.clientX - drag.dx, y: e.clientY - drag.dy }); }}
        onPointerUp={() => setDrag(null)}>
        <span>Notes</span>
        <button type="button" aria-label="Close notes" onClick={onClose} className="bg-none border-0 text-slate">✕</button>
      </header>
      <textarea aria-label="Web notes" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} className="w-full border-0 border-t border-line bg-transparent text-parchment px-2.5 py-2 resize-y min-h-[90px]" />
    </div>
  );
}
