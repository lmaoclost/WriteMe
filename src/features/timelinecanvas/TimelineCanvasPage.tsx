import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { TLNotepad } from "./TLNotepad";
import type { TimelineWire } from "../../domain/types";
import "./timelinecanvas.css";

export const BEAD_PRESET_COLORS = [
  "#e67e22", "#e74c3c", "#2ecc71", "#3498db", "#9b59b6",
  "#f1c40f", "#1abc9c", "#e84393", "#2c3e50", "#7f8c8d",
];

export function TimelineCanvasPage({ timelineId }: { timelineId: string }) {
  const timeline = useScriptorium((s) => (s.timelines ?? []).find((t) => t.id === timelineId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const pushTLHistory = useScriptorium((s) => s.pushTLHistory);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`tl_${timelineId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  const stageRef = useRef<HTMLDivElement>(null);
  const view = useRef({ s: 0.4, panX: 100, panY: 0 });
  const viewTick = useRef(0);
  const [, setDraw] = useState(0);
  const markDirty = () => { viewTick.current++; setDraw((t) => t + 1); };
  const [selectedBeadId, setSelectedBeadId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const beadDrag = useRef<{ id: string; sx: number; beadX: number; startBeadY?: number } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  useEffect(() => {
    if (!timeline) pushToast("error", "Timeline not found.");
  }, [timeline, pushToast]);

  if (!timeline) return null;

  return (
    <div className="timelinecanvas-page" data-testid="timelinecanvas-page">
      <header className="bl-header">
        <input
          className="bl-name"
          aria-label="Timeline name"
          value={timeline.name}
          onChange={(e) => useScriptorium.getState().renameTimeline(timelineId, e.target.value)}
        />
        <div className="bl-actions">
          <button type="button" aria-label="Undo" disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoTL(timelineId)}>↶</button>
          <button type="button" aria-label="Redo" disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoTL(timelineId)}>↷</button>
          <button type="button" onClick={() => { pushTLHistory(timelineId); const el = stageRef.current; const x = el && el.clientWidth ? (el.clientWidth / 2 - view.current.panX) / view.current.s : 4000; const created = useScriptorium.getState().addBead(timelineId, { x, y: 200 }); if (created) { setSelectedBeadId(created.id); markDirty(); } }}>Add event</button>
          <button type="button" onClick={() => { pushTLHistory(timelineId); useScriptorium.getState().addSegment(timelineId, 1000, 3000, "New era"); }}>Add segment</button>
          <button type="button" onClick={() => setNotesOpen((v) => !v)}>Notas</button>
        </div>
      </header>
      <div className="bl-body">
        <div
          className="bl-canvas"
          data-testid="tl-canvas"
          ref={stageRef}
          style={{ cursor: pan.current ? "grabbing" : "grab" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if ((e.target as Element).closest(".tl-bead") || (e.target as Element).closest(".tl-seg")) return;
            pan.current = { x: e.clientX, y: e.clientY, basePanX: view.current.panX, basePanY: view.current.panY };
            markDirty();
          }}
          onPointerMove={(e) => {
            const d = beadDrag.current;
            if (d) {
              const dx = (e.clientX - d.sx) / view.current.s;
              const rect = stageRef.current?.getBoundingClientRect();
              const y = rect ? (e.clientY - rect.top - view.current.panY) / view.current.s : d.startBeadY ?? 0;
              useScriptorium.getState().moveBead(d.id, d.beadX + dx, y);
              markDirty();
              return;
            }
            const p = pan.current;
            if (p) {
              view.current = { ...view.current, panX: p.basePanX + (e.clientX - p.x), panY: p.basePanY + (e.clientY - p.y) };
              markDirty();
            }
          }}
          onPointerUp={() => { beadDrag.current = null; pan.current = null; markDirty(); }}
          onWheel={(e: React.WheelEvent) => {
            e.preventDefault();
            const rect = stageRef.current?.getBoundingClientRect();
            if (!rect) return;
            const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
            const s = Math.min(8, Math.max(0.1, view.current.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
            const relX = (sx - view.current.panX) / view.current.s;
            const relY = (sy - view.current.panY) / view.current.s;
            view.current = { s, panX: sx - relX * s, panY: sy - relY * s };
            markDirty();
          }}
        >
          <div
            className="bl-plane"
            data-testid="tl-plane"
            style={{
              width: 20000, height: 20000,
              transform: `translate(${view.current.panX}px, ${view.current.panY}px) scale(${view.current.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="tl-wire-svg" className="edges-layer" width="100%" height="100%">
              {/* segments draw over the base wire */}
              <line data-testid="tl-wire-base" x1={0} y1={200} x2={20000} y2={200} className="tl-wire-base" />
              {timeline.segments.map((g) => (
                <g key={g.id} data-testid="tl-seg" className="tl-seg"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    setSelectedBeadId(g.id);
                  }}>
                  <line x1={g.fromX} y1={200} x2={g.toX} y2={200} stroke={g.lineColor} strokeWidth={4} />
                  <text x={(g.fromX + g.toX) / 2} y={186} className="tl-seg-label" fill={g.lineColor} textAnchor="middle">{g.label}</text>
                </g>
              ))}
              {timeline.beads.map((b) => (
                <g key={b.id} data-testid="tl-bead" className="tl-bead"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    setSelectedBeadId(b.id);
                    beadDrag.current = { id: b.id, sx: e.clientX, beadX: b.x, startBeadY: b.y };
                    pushTLHistory(timelineId);
                  }}
                  transform={`translate(${b.x}, ${b.y})`}>
                  <line x1={0} y1={0} x2={0} y2={200 - b.y} className="tl-bead-stem" />
                  <circle cx={0} cy={0} r={8} fill={b.color} className="tl-bead-dot" />
                  <text x={0} y={-18} className="tl-bead-label" textAnchor="middle">{b.label}</text>
                  {b.dateText ? <text x={0} y={-34} className="tl-bead-date" textAnchor="middle">{b.dateText}</text> : null}
                  {b.summary ? <text x={0} y={14} className="tl-bead-summary" textAnchor="middle">{b.summary.slice(0, 40)}</text> : null}
                </g>
              ))}
            </svg>
          </div>
          {timeline.beads.length === 0 ? (
            <div className="bl-empty">Coloque o primeiro evento no fio — clique e arraste.</div>
          ) : null}
          {notesOpen ? <TLNotepad notes={timeline.notes} onNotes={(v) => useScriptorium.getState().setTimelineNotes(timelineId, v)} onClose={() => setNotesOpen(false)} /> : null}
          {/* invisible selection guard for tests */}
          <div className="tl-selected-sentinel" data-selected-bead={selectedBeadId ?? ""} style={{ display: "none" }} />
        </div>
        <BeadPanel timeline={timeline} selectedId={selectedBeadId} onSelect={setSelectedBeadId} />
      </div>
    </div>
  );
}

function BeadPanel({ timeline, selectedId, onSelect }: {
  timeline: TimelineWire;
  selectedId: string | null;
  onSelect(id: string | null): void;
}) {
  const store = useScriptorium.getState;
  const pushToast = useScriptorium((s) => s.pushToast);
  const bead = timeline.beads.find((b) => b.id === selectedId);
  const seg = timeline.segments.find((g) => g.id === selectedId);
  const [armDelete, setArmDelete] = useState(false);

  if (!bead && !seg) {
    return (
      <aside className="bl-panel" data-testid="tl-panel">
        <p className="bl-panel-hint">Escolha um evento ou era no fio.</p>
      </aside>
    );
  }

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    if (bead) { store().deleteBead(bead.id); pushToast("success", "Event deleted."); }
    if (seg) { store().deleteSegment(seg.id); pushToast("success", "Segment deleted."); }
    onSelect(null);
  };

  return (
    <aside className="bl-panel" data-testid="tl-panel">
      <header className="bl-panel-head">
        <h2>{bead?.label ?? seg?.label}</h2>
        <button type="button" className={armDelete ? "btn-danger" : ""} onClick={remove}
          aria-label={armDelete ? "Confirm delete" : "Excluir"}>
          {armDelete ? "Confirmar?" : "Excluir"}
        </button>
      </header>
      {bead ? (
        <>
          <div className="field">
            <span className="field-label">Label</span>
            <input aria-label="Event label" defaultValue={bead.label}
              onBlur={(e) => store().updateBead(bead.id, { label: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Date</span>
            <input aria-label="Event date" defaultValue={bead.dateText ?? ""}
              onBlur={(e) => store().updateBead(bead.id, { dateText: e.target.value.trim() || undefined })} />
          </div>
          <label className="field">
            <span className="field-label">Summary</span>
            <textarea aria-label="Event summary" rows={3} defaultValue={bead.summary ?? ""}
              onBlur={(e) => store().updateBead(bead.id, { summary: e.target.value.trim() || undefined })} />
          </label>
          <div className="field">
            <span className="field-label">Color</span>
            <div className="color-row" role="listbox" aria-label="Event color">
              {BEAD_PRESET_COLORS.map((c) => (
                <button key={c} type="button" role="option" aria-selected={bead.color === c}
                  className={`color-swatch${bead.color === c ? " current" : ""}`} style={{ background: c }}
                  onClick={() => store().updateBead(bead.id, { color: c })} />
              ))}
            </div>
          </div>
        </>
      ) : null}
      {seg ? (
        <>
          <div className="field">
            <span className="field-label">Segment name</span>
            <input aria-label="Segment name" defaultValue={seg.label}
              onBlur={(e) => store().updateSegment(seg.id, { label: e.target.value })} />
          </div>
          <div className="field">
            <span className="field-label">Line color</span>
            <input type="color" aria-label="Segment line color" defaultValue={seg.lineColor}
              onBlur={(e) => store().updateSegment(seg.id, { lineColor: e.target.value })} />
          </div>
        </>
      ) : null}
    </aside>
  );
}
