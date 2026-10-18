import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { TLNotepad } from "./TLNotepad";
import { LinkPicker } from "../atlas/panels/LinkPicker";
import { EntryPreview, entryBlurb } from "../entries/EntryPreview";
import { categoryIcon, categoryLabel } from "../entries/categories";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";
import type { TimelineWire, TimelineBead } from "../../domain/types";
import { withCurrentColor } from "../../ui/colors";
import { useBoardNotesHotkey } from "../../ui/boardNotes";


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
  const navigate = useNavigate();
  const view = useRef({ s: 0.4, panX: 100, panY: 0 });
  const viewTick = useRef(0);
  const [, setDraw] = useState(0);
  const markDirty = () => { viewTick.current++; setDraw((t) => t + 1); };
  const [selectedBeadId, setSelectedBeadId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const beadDrag = useRef<{ id: string; sx: number; beadX: number; startBeadY?: number } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  useEffect(() => {
    if (!timeline) pushToast("error", "Timeline not found.");
  }, [timeline, pushToast]);

  if (!timeline) return null;

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="timelinecanvas-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label="Timeline name"
          value={timeline.name}
          onChange={(e) => useScriptorium.getState().renameTimeline(timelineId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label="Undo" className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoTL(timelineId)}>↶</button>
          <button type="button" aria-label="Redo" className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoTL(timelineId)}>↷</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => { pushTLHistory(timelineId); const el = stageRef.current; const x = el && el.clientWidth ? (el.clientWidth / 2 - view.current.panX) / view.current.s : 4000; const created = useScriptorium.getState().addBead(timelineId, { x, y: -60 }); if (created) { setSelectedBeadId(created.id); markDirty(); } }}>Add event</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => { pushTLHistory(timelineId); useScriptorium.getState().addSegment(timelineId, 1000, 3000, "New era"); }}>Add segment</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>Notes ✎</button>
        </div>
      </header>
      <div className="grid grid-cols-[1fr_300px] min-h-0 overflow-hidden">
        <div
          className="relative overflow-hidden bg-ink cursor-grab active:cursor-grabbing"
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
            className="absolute bg-[radial-gradient(circle_at_25%_25%,#17162a,var(--ink)_65%)] shadow-[inset_0_0_0_1px_var(--line)]"
            data-testid="tl-plane"
            style={{
              width: 20000, height: 20000,
              transform: `translate(${view.current.panX}px, ${view.current.panY}px) scale(${view.current.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="tl-wire-svg" className="edges-layer absolute left-2 top-2 w-full h-full pointer-events-none" width="100%" height="100%">
              {/* segments draw over the base wire */}
              <line data-testid="tl-wire-base" x1={0} y1={200} x2={20000} y2={200} className="tl-wire-base [stroke:var(--gold-dim)] [stroke-width:3]" />
              {timeline.segments.map((g) => (
                <g key={g.id} data-testid="tl-seg" className="tl-seg"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    setSelectedBeadId(g.id);
                  }}>
                  <line x1={g.fromX} y1={200} x2={g.toX} y2={200} stroke={g.lineColor} strokeWidth={4} />
                  <text x={(g.fromX + g.toX) / 2} y={186} className="tl-seg-label text-sm font-display" fill={g.lineColor} textAnchor="middle">{g.label}</text>
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
                  onDoubleClick={() => {
                    if (!b.entryId) return;
                    navigate(`/p/${timeline.projectId}/entries?e=${b.entryId}`);
                  }}
                  transform={`translate(${b.x}, ${b.y})`}>
                  {b.entryId ? <title>Abre no codex</title> : null}
                  <line x1={0} y1={0} x2={0} y2={200 - b.y} className="tl-bead-stem [stroke:var(--line)] [stroke-width:1.5]" />
                  <circle cx={0} cy={0} r={8} fill={b.color} className="tl-bead-dot cursor-pointer" />
                  <text x={0} y={-18} className="tl-bead-label text-sm fill-parchment font-semibold" textAnchor="middle">{b.label}</text>
                  {b.dateText ? <text x={0} y={-34} className="tl-bead-date text-[11px] fill-gold font-mono" textAnchor="middle">{b.dateText}</text> : null}
                  {b.summary ? <text x={0} y={14} className="tl-bead-summary text-[0.6875rem] fill-slate" textAnchor="middle">{b.summary.slice(0, 40)}</text> : null}
                </g>
              ))}
            </svg>
          </div>
          {timeline.beads.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[calc(1/var(--bl-scale,0.1))] text-slate whitespace-nowrap">Coloque o primeiro evento no fio — botão "Add event" cria no centro do view.</div>
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

/** A bead may point at a tome entry: picker + preview card + click-through. */
function TomeEntryLink({ timeline, bead, onNavigate }: {
  timeline: TimelineWire;
  bead: TimelineBead;
  onNavigate(entryId: string): void;
}) {
  const entries = useScriptorium(useShallow((s) => s.entries.filter((e) => e.projectId === timeline.projectId)));
  const entry = entries.find((e) => e.id === bead.entryId);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5" data-testid="bead-tome-link">
      <span className="field-label text-xs font-semibold uppercase tracking-[0.08em] text-slate">Tome entry</span>
      {entry ? (
        <EntryPreview
          data={{
            entryId: entry.id,
            title: entry.title,
            icon: categoryIcon(entry.category),
            categoryLabel: categoryLabel(entry.category),
            blurb: entryBlurb(entry.summary, entry.body),
          }}
          onOpen={onNavigate}
        />
      ) : null}
      <LinkPicker
        entries={entries}
        currentEntryId={bead.entryId ?? null}
        onPick={(id) => useScriptorium.getState().updateBead(bead.id, { entryId: id })}
        onClear={() => useScriptorium.getState().updateBead(bead.id, { entryId: undefined })}
      />
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
  const navigate = useNavigate();
  const bead = timeline.beads.find((b) => b.id === selectedId);
  const seg = timeline.segments.find((g) => g.id === selectedId);
  const [armDelete, setArmDelete] = useState(false);

  if (!bead && !seg) {
    return (
      <aside className={BOARD_PANEL} data-testid="tl-panel">
        <p className={BOARD_PANEL_HINT}>Escolha um evento ou era no fio.</p>
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
    <aside className={BOARD_PANEL} data-testid="tl-panel">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{bead?.label ?? seg?.label}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={remove}
          aria-label={armDelete ? "Confirm delete" : "Excluir"}>
          {armDelete ? "Confirmar?" : "Excluir"}
        </Button>
      </header>
      {bead ? (
        <>
          <Field label="Label">
            <input aria-label="Event label" defaultValue={bead.label}
              onBlur={(e) => store().updateBead(bead.id, { label: e.target.value })} />
          </Field>
          <Field label="Date">
            <input aria-label="Event date" defaultValue={bead.dateText ?? ""}
              onBlur={(e) => store().updateBead(bead.id, { dateText: e.target.value.trim() || undefined })} />
          </Field>
          <Field label="Summary">
            <textarea aria-label="Event summary" rows={3} defaultValue={bead.summary ?? ""}
              onBlur={(e) => store().updateBead(bead.id, { summary: e.target.value.trim() || undefined })} />
          </Field>
          <TomeEntryLink timeline={timeline} bead={bead} onNavigate={(entryId) => navigate(`/p/${timeline.projectId}/entries?e=${entryId}`)} />
          <Field label="Color">
            <div className="color-row flex flex-wrap gap-1.5" role="listbox" aria-label="Event color">
              {withCurrentColor(BEAD_PRESET_COLORS, bead.color).map((c) => (
                <button key={c} type="button" role="option" aria-selected={bead.color === c}
                  className={`color-swatch size-5 rounded-full border border-transparent cursor-pointer${bead.color === c ? " outline outline-2 outline-parchment" : ""}`} style={{ background: c }}
                  onClick={() => store().updateBead(bead.id, { color: c })} />
              ))}
            </div>
          </Field>
        </>
      ) : null}
      {seg ? (
        <>
          <Field label="Segment name">
            <input aria-label="Segment name" defaultValue={seg.label}
              onBlur={(e) => store().updateSegment(seg.id, { label: e.target.value })} />
          </Field>
          <Field label="Line color">
            <input type="color" aria-label="Segment line color" defaultValue={seg.lineColor}
              onBlur={(e) => store().updateSegment(seg.id, { lineColor: e.target.value })} className="h-9 w-full bg-ink border border-line rounded-sm" />
          </Field>
        </>
      ) : null}
    </aside>
  );
}
