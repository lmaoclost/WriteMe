import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { useRafCallback } from "../../ui/useRaf";

const SEG_LINE_Y = 200;
const SEG_LANE_GAP = 34;

/** Greedy interval lanes: overlapping eras get different rows so both stay
 *  visible and clickable. Input order is preserved for stable ids. */
function layoutSegments(segments: TimelineWire["segments"]): Map<string, number> {
  const sorted = [...segments].sort((a, b) => Math.min(a.fromX, a.toX) - Math.min(b.fromX, b.toX));
  const laneEnds: number[] = [];
  const laneById = new Map<string, number>();
  for (const g of sorted) {
    const start = Math.min(g.fromX, g.toX);
    const end = Math.max(g.fromX, g.toX);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    laneById.set(g.id, lane);
  }
  return laneById;
}

const TLSegmentsLayer = memo(function TLSegmentsLayer({ segments, handleSegDown }: {
  segments: TimelineWire["segments"];
  handleSegDown(g: TimelineWire["segments"][number], e: React.PointerEvent): void;
}) {
  const lanes = useMemo(() => layoutSegments(segments), [segments]);
  return (
    <>
      {segments.map((g) => {
        const y = SEG_LINE_Y - (lanes.get(g.id) ?? 0) * SEG_LANE_GAP;
        return (
          <g key={g.id} data-testid="tl-seg" className="tl-seg" onPointerDown={(e) => handleSegDown(g, e)}>
            {/* invisible wide hit area: a 4px line is hard to click */}
            <line x1={g.fromX} y1={y} x2={g.toX} y2={y} stroke="transparent" strokeWidth={18} className="tl-seg-hit" />
            <line x1={g.fromX} y1={y} x2={g.toX} y2={y} stroke={g.lineColor} strokeWidth={4} />
            <text x={(g.fromX + g.toX) / 2} y={y - 14} className="tl-seg-label text-sm font-display" fill={g.lineColor} textAnchor="middle">{g.label}</text>
          </g>
        );
      })}
    </>
  );
});

const TLBeadsLayer = memo(function TLBeadsLayer({ beads, handleBeadDown, handleBeadDoubleClick }: {
  beads: TimelineBead[];
  handleBeadDown(b: TimelineBead, e: React.PointerEvent): void;
  handleBeadDoubleClick(b: TimelineBead): void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {beads.map((b) => (
        <g key={b.id} data-testid="tl-bead" className="tl-bead"
          onPointerDown={(e) => handleBeadDown(b, e)}
          onDoubleClick={() => handleBeadDoubleClick(b)}
          transform={`translate(${b.x}, ${b.y})`}>
          {b.entryId ? <title>{t("timeline.panel.opensInCodex")}</title> : null}
          <line x1={0} y1={0} x2={0} y2={200 - b.y} className="tl-bead-stem [stroke:var(--line)] [stroke-width:1.5]" />
          <circle cx={0} cy={0} r={8} fill={b.color} className="tl-bead-dot cursor-pointer" />
          <text x={0} y={-18} className="tl-bead-label text-sm fill-parchment font-semibold" textAnchor="middle">{b.label}</text>
          {b.dateText ? <text x={0} y={-34} className="tl-bead-date text-[11px] fill-gold font-mono" textAnchor="middle">{b.dateText}</text> : null}
          {b.summary ? <text x={0} y={14} className="tl-bead-summary text-[0.6875rem] fill-slate" textAnchor="middle">{b.summary.slice(0, 40)}</text> : null}
        </g>
      ))}
    </>
  );
});


export const BEAD_PRESET_COLORS = [
  "#e67e22", "#e74c3c", "#2ecc71", "#3498db", "#9b59b6",
  "#f1c40f", "#1abc9c", "#e84393", "#2c3e50", "#7f8c8d",
];

export function TimelineCanvasPage({ timelineId }: { timelineId: string }) {
  const { t } = useTranslation();
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
  // markDirty coalesced: a pointermove/wheel burst re-renders once per frame
  const markDirty = useRafCallback(() => { viewTick.current++; setDraw((t) => t + 1); });
  const [selectedBeadId, setSelectedBeadId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const beadDrag = useRef<{ id: string; sx: number; beadX: number; startBeadY?: number } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  // Coalesced drag: at most one moveBead per frame; pointerup flushes.
  const moveBeadRaf = useRafCallback((id: string, x: number, y: number) => {
    useScriptorium.getState().moveBead(id, x, y);
  });

  useEffect(() => {
    if (!timeline) pushToast("error", t("timeline.page.notFound"));
  }, [timeline, pushToast, t]);

  const fitToContentNow = () => {
    const el = stageRef.current;
    if (!el || !el.clientWidth || !timeline) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const b of timeline.beads) {
      if (b.x < minX) minX = b.x;
      if (b.x > maxX) maxX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.y > maxY) maxY = b.y;
    }
    for (const g of timeline.segments) {
      if (g.fromX < minX) minX = g.fromX;
      if (g.toX < minX) minX = g.toX;
      if (g.fromX > maxX) maxX = g.fromX;
      if (g.toX > maxX) maxX = g.toX;
    }
    if (minX === Infinity) return; // keep the default view for an empty wire
    const PAD = 80;
    const WIRE_Y = 200;
    minY = Math.min(minY, WIRE_Y);
    maxY = Math.max(maxY, WIRE_Y);
    minX -= PAD; maxX += PAD; minY -= PAD; maxY += PAD;
    const s = Math.min(1, Math.max(0.1, Math.min(el.clientWidth / (maxX - minX), el.clientHeight / (maxY - minY))));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    view.current = { s, panX: el.clientWidth / 2 - cx * s, panY: el.clientHeight / 2 - cy * s };
    markDirty();   // schedule the render
    markDirty.flush(); // single-shot fit: commit synchronously
  };

  // fit once per timeline mount — content must be ON-SCREEN (beads sit above
  // the wire at negative y and the default view leaves them above the clip)
  useEffect(() => {
    fitToContentNow();
  }, [timelineId]);

  const elWidth = () => stageRef.current?.clientWidth ?? 1200;
  const elHeight = () => stageRef.current?.clientHeight ?? 800;
  const zoomAt = (v: { s: number; panX: number; panY: number }, factor: number, cx: number, cy: number) => {
    const s = Math.min(8, Math.max(0.05, v.s * factor));
    const relX = (cx - v.panX) / v.s;
    const relY = (cy - v.panY) / v.s;
    return { s, panX: cx - relX * s, panY: cy - relY * s };
  };

  // Wheel zoom on a native non-passive listener; view ref is the sync source
  // of truth, markDirty coalesces the re-render.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const s = Math.min(8, Math.max(0.1, view.current.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      const relX = (sx - view.current.panX) / view.current.s;
      const relY = (sy - view.current.panY) / view.current.s;
      view.current = { s, panX: sx - relX * s, panY: sy - relY * s };
      markDirty();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [markDirty]);

  if (!timeline) return null;

  // Stable delegates for the memoized layers (resolved at event time).
  const layerHandlersRef = useRef<{
    beadDown(b: TimelineBead, e: React.PointerEvent): void;
    beadDoubleClick(b: TimelineBead): void;
    segDown(g: TimelineWire["segments"][number], e: React.PointerEvent): void;
  } | null>(null);
  layerHandlersRef.current = {
    beadDown: (b, e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setSelectedBeadId(b.id);
      beadDrag.current = { id: b.id, sx: e.clientX, beadX: b.x, startBeadY: b.y };
      pushTLHistory(timelineId);
    },
    beadDoubleClick: (b) => {
      if (!b.entryId) return;
      navigate(`/p/${timeline.projectId}/entries?e=${b.entryId}`);
    },
    segDown: (g, e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setSelectedBeadId(g.id);
    },
  };
  const handleBeadDown = useCallback((b: TimelineBead, e: React.PointerEvent) => layerHandlersRef.current?.beadDown(b, e), []);
  const handleBeadDoubleClick = useCallback((b: TimelineBead) => layerHandlersRef.current?.beadDoubleClick(b), []);
  const handleSegDown = useCallback((g: TimelineWire["segments"][number], e: React.PointerEvent) => layerHandlersRef.current?.segDown(g, e), []);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="timelinecanvas-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label={t("timeline.page.name")}
          value={timeline.name}
          onChange={(e) => useScriptorium.getState().renameTimeline(timelineId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label={t("timeline.page.undo")} className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoTL(timelineId)}>↶</button>
          <button type="button" aria-label={t("timeline.page.redo")} className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoTL(timelineId)}>↷</button>
          <button type="button" aria-label={t("timeline.page.zoomOut")} className={BOARD_ACTION_BTN} onClick={() => { view.current = zoomAt({ ...view.current }, 1 / 1.25, elWidth() / 2, elHeight() / 2); markDirty.flush(); }}>−</button>
          <span className="text-slate text-xs font-mono self-center" data-testid="tlc-zoom">{Math.round(view.current.s * 100)}%</span>
          <button type="button" aria-label={t("timeline.page.zoomIn")} className={BOARD_ACTION_BTN} onClick={() => { view.current = zoomAt({ ...view.current }, 1.25, elWidth() / 2, elHeight() / 2); markDirty.flush(); }}>+</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => fitToContentNow()}>{t("timeline.page.fit")}</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => { pushTLHistory(timelineId); const el = stageRef.current; const x = el && el.clientWidth ? (el.clientWidth / 2 - view.current.panX) / view.current.s : 4000; const created = useScriptorium.getState().addBead(timelineId, { x, y: -60 }); if (created) { setSelectedBeadId(created.id); markDirty.flush(); } }}>{t("timeline.page.addEvent")}</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => { pushTLHistory(timelineId); useScriptorium.getState().addSegment(timelineId, 1000, 3000, t("timeline.page.defaultSegment")); }}>{t("timeline.page.addSegment")}</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>{t("timeline.page.notes")}</button>
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
              moveBeadRaf(d.id, d.beadX + dx, y);
              markDirty();
              return;
            }
            const p = pan.current;
            if (p) {
              view.current = { ...view.current, panX: p.basePanX + (e.clientX - p.x), panY: p.basePanY + (e.clientY - p.y) };
              markDirty();
            }
          }}
          onPointerUp={() => { moveBeadRaf.flush(); beadDrag.current = null; pan.current = null; markDirty.flush(); }}
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
            <svg data-testid="tl-wire-svg" className="edges-layer overflow-visible absolute left-2 top-2 w-full h-full pointer-events-none [&_.tl-bead]:pointer-events-auto [&_.tl-seg]:pointer-events-auto" width="100%" height="100%">
              {/* segments draw over the base wire */}
              <line data-testid="tl-wire-base" x1={0} y1={200} x2={20000} y2={200} className="tl-wire-base [stroke:var(--gold-dim)] [stroke-width:3]" />
              <TLSegmentsLayer segments={timeline.segments} handleSegDown={handleSegDown} />
              <TLBeadsLayer beads={timeline.beads} handleBeadDown={handleBeadDown} handleBeadDoubleClick={handleBeadDoubleClick} />
            </svg>
          </div>
          {timeline.beads.length === 0 ? (
            <div className="board-empty-hint absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate">{t("timeline.page.emptyHint")}</div>
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
  const { t } = useTranslation();
  const entries = useScriptorium(useShallow((s) => s.entries.filter((e) => e.projectId === timeline.projectId)));
  const entry = entries.find((e) => e.id === bead.entryId);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5" data-testid="bead-tome-link">
      <span className="field-label text-xs font-semibold uppercase tracking-[0.08em] text-slate">{t("timeline.panel.tomeEntry")}</span>
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
  const { t } = useTranslation();
  const store = useScriptorium.getState;
  const pushToast = useScriptorium((s) => s.pushToast);
  const navigate = useNavigate();
  const bead = timeline.beads.find((b) => b.id === selectedId);
  const seg = timeline.segments.find((g) => g.id === selectedId);
  const [armDelete, setArmDelete] = useState(false);

  if (!bead && !seg) {
    return (
      <aside className={BOARD_PANEL} data-testid="tl-panel">
        <p className={BOARD_PANEL_HINT}>{t("timeline.panel.selectHint")}</p>
      </aside>
    );
  }

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    if (bead) { store().deleteBead(bead.id); pushToast("success", t("timeline.panel.eventDeleted")); }
    if (seg) { store().deleteSegment(seg.id); pushToast("success", t("timeline.panel.segmentDeleted")); }
    onSelect(null);
  };

  return (
    <aside className={BOARD_PANEL} data-testid="tl-panel">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{bead?.label ?? seg?.label}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={remove}
          aria-label={armDelete ? t("timeline.panel.confirmDelete") : t("timeline.panel.delete")}>
          {armDelete ? t("common.confirm") : t("timeline.panel.delete")}
        </Button>
      </header>
      {bead ? (
        <>
          <Field label={t("timeline.panel.label")}>
            <input aria-label={t("timeline.panel.eventLabel")} defaultValue={bead.label}
              onBlur={(e) => store().updateBead(bead.id, { label: e.target.value })} />
          </Field>
          <Field label={t("timeline.panel.date")}>
            <input aria-label={t("timeline.panel.eventDate")} defaultValue={bead.dateText ?? ""}
              onBlur={(e) => store().updateBead(bead.id, { dateText: e.target.value.trim() || undefined })} />
          </Field>
          <Field label={t("timeline.panel.summary")}>
            <textarea aria-label={t("timeline.panel.eventSummary")} rows={3} defaultValue={bead.summary ?? ""}
              onBlur={(e) => store().updateBead(bead.id, { summary: e.target.value.trim() || undefined })} />
          </Field>
          <TomeEntryLink timeline={timeline} bead={bead} onNavigate={(entryId) => navigate(`/p/${timeline.projectId}/entries?e=${entryId}`)} />
          <Field label={t("timeline.panel.color")}>
            <div className="color-row flex flex-wrap gap-1.5" role="listbox" aria-label={t("timeline.panel.eventColor")}>
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
          <Field label={t("timeline.panel.segmentName")}>
            <input aria-label={t("timeline.panel.segmentName")} defaultValue={seg.label}
              onBlur={(e) => store().updateSegment(seg.id, { label: e.target.value })} />
          </Field>
          <Field label={t("timeline.panel.lineColor")}>
            <input type="color" aria-label={t("timeline.panel.segmentLineColor")} defaultValue={seg.lineColor}
              onBlur={(e) => store().updateSegment(seg.id, { lineColor: e.target.value })} className="h-9 w-full bg-ink border border-line rounded-sm" />
          </Field>
        </>
      ) : null}
    </aside>
  );
}
