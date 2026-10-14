import { useEffect, useState } from "react";

export function Notepad({ notes, onNotes, onClose }: {
  notes: string;
  onNotes(v: string): void;
  onClose(): void;
}) {
  const [draft, setDraft] = useState(notes);
  const [pos, setPos] = useState<{ x?: number; y?: number }>({});
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  useEffect(() => {
    const id = setTimeout(() => { if (draft !== notes) onNotes(draft); }, 300);
    return () => clearTimeout(id);
  }, [draft, notes, onNotes]);
  const onDragMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setPos({ x: e.clientX - drag.dx, y: e.clientY - drag.dy });
  };
  return (
    <div
      className="bl-notepad"
      data-testid="bl-notepad"
      style={pos.x != null ? { position: "fixed", left: pos.x, top: pos.y, right: "auto" } : undefined}
    >
      <header
        className="bl-notepad-head"
        onPointerDown={(e) => { if (e.button === 0) setDrag({ dx: e.clientX, dy: e.clientY }); }}
        onPointerMove={onDragMove}
        onPointerUp={() => setDrag(null)}
      >
        <span>Notas</span>
        <button type="button" aria-label="Fechar notas" onClick={onClose}>✕</button>
      </header>
      <textarea
        aria-label="Notas da linhagem"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
      />
    </div>
  );
}