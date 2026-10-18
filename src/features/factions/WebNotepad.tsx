import { useEffect, useRef, useState } from "react";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";

export function WebNotepad({ notes, onNotes, onClose }: {
  notes: string;
  onNotes(v: string): void;
  onClose(): void;
}) {
  // debounced draft flushes on unmount — closing the notepad must not drop
  // the pending <=300ms commit (the old local timer did exactly that)
  const { draft, setDraft, flush } = useDebouncedDraft(notes, onNotes);
  useEffect(() => () => flush(), [flush]);

  const [pos, setPos] = useState<{ x?: number; y?: number }>({});
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const nextRef = useRef<{ x: number; y: number } | null>(null);

  const applyMove = () => {
    rafRef.current = null;
    if (nextRef.current) setPos(nextRef.current);
  };

  const headerDrag = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      dragRef.current = { dx: e.clientX, dy: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      nextRef.current = { x: e.clientX - d.dx, y: e.clientY - d.dy };
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(applyMove);
    },
    onPointerUp: (e: React.PointerEvent) => {
      dragRef.current = null;
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (nextRef.current) setPos(nextRef.current);
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    },
  };

  return (
    <div
      className="absolute top-3.5 left-auto w-[260px] z-39 bg-night-2 border border-gold-dim rounded-lg shadow-[0_6px_18px_var(--scrim-canvas)]"
      data-testid="web-notepad"
      style={pos.x != null ? { position: "fixed", left: pos.x, top: pos.y, right: "auto" } : undefined}>
      <header className="flex justify-between items-center px-2.5 py-1.5 cursor-move text-gold text-xs tracking-[0.1em] uppercase" {...headerDrag}>
        <span>Notes</span>
        <button type="button" aria-label="Close notes" onClick={() => { flush(); onClose(); }} className="bg-none border-0 text-slate">✕</button>
      </header>
      <textarea aria-label="Web notes" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} className="w-full border-0 border-t border-line bg-transparent text-parchment px-2.5 py-2 resize-y min-h-[90px]" />
    </div>
  );
}