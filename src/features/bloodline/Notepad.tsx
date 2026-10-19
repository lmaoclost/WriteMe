import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function Notepad({ notes, onNotes, onClose }: {
  notes: string;
  onNotes(v: string): void;
  onClose(): void;
}) {
  const { t } = useTranslation();
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
      className="absolute top-3.5 right-[320px] w-[260px] z-39 bg-night-2 border border-gold-dim rounded-lg shadow-[0_6px_18px_var(--scrim-canvas)]"
      data-testid="bl-notepad"
      style={pos.x != null ? { position: "fixed", left: pos.x, top: pos.y, right: "auto" } : undefined}
    >
      <header
        className="flex justify-between items-center px-2.5 py-1.5 cursor-move text-gold text-xs tracking-[0.1em] uppercase"
        onPointerDown={(e) => { if (e.button === 0) setDrag({ dx: e.clientX, dy: e.clientY }); }}
        onPointerMove={onDragMove}
        onPointerUp={() => setDrag(null)}
      >
        <span>{t("bloodline.notepad.title")}</span>
        <button type="button" aria-label={t("bloodline.notepad.close")} onClick={onClose} className="bg-none border-0 text-slate">✕</button>
      </header>
      <textarea
        aria-label={t("bloodline.notepad.aria")}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        className="w-full border-0 border-t border-line bg-transparent text-parchment px-2.5 py-2 resize-y min-h-[90px]"
      />
    </div>
  );
}
