import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useWriteme } from "../../data/store";
import { TLNotepad } from "./TLNotepad";
import { LinkPicker } from "../atlas/panels/LinkPicker";
import { EntryPreview, entryBlurb } from "../entries/EntryPreview";
import { categoryIcon, categoryLabel } from "../entries/categories";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";
import { useBoardNotesHotkey } from "../../ui/boardNotes";
import { useRafCallback } from "../../ui/useRaf";
import { contentEnd, eraSpans, eraStart, type EraSpan } from "../../domain/timeline";
import { withCurrentColor } from "../../ui/colors";
import type { TimelineWire, TimelineBead, CalendarEventRef } from "../../domain/types";

const WIRE_Y = 200;
const BAND_H = 20;
/** Below this width on screen (plane × zoom) a band keeps its color, drops its name. */
const LABEL_MIN_PX = 60;

const TLSegmentsLayer = memo(function TLSegmentsLayer({ spans, zoom, selectedId, handleEraDown, handleEraDoubleClick }: {
  spans: EraSpan[];
  zoom: number;
  selectedId: string | null;
  handleEraDown(span: EraSpan, e: React.PointerEvent): void;
  handleEraDoubleClick(span: EraSpan): void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {spans.map((span) => {
        const width = span.end - span.start;
        const selected = span.era.id === selectedId;
        const bound = !!span.era.boundaryBeadId;
        return (
          <g key={span.era.id} data-testid="tl-era" className="tl-era"
            onPointerDown={(e) => handleEraDown(span, e)}
            onDoubleClick={() => handleEraDoubleClick(span)}>
            <rect
              x={span.start} y={WIRE_Y - BAND_H / 2} width={width} height={BAND_H}
              rx={3} fill={span.era.lineColor} fillOpacity={selected ? 0.45 : 0.22}
              stroke={span.era.lineColor} strokeWidth={selected ? 3 : 2}
            />
            {/* a boundary tied to an event is drawn as a notch so it reads as a hinge */}
            {bound ? <line x1={span.start} y1={WIRE_Y - BAND_H / 2 - 6} x2={span.start} y2={WIRE_Y + BAND_H / 2 + 6} stroke={span.era.lineColor} strokeWidth={2} /> : null}
            {width * zoom >= LABEL_MIN_PX ? (
              <text x={span.start + width / 2} y={WIRE_Y - BAND_H / 2 - 8} className="tl-era-label text-sm font-display fill-parchment" textAnchor="middle">{span.era.label}</text>
            ) : null}
            <title>{t("timeline.panel.startsAt")}</title>
          </g>
        );
      })}
    </>
  );
});

const STAR_POINTS = "0,-11 3.2,-3.5 11,-3.5 4.6,1.6 7,9.5 0,5 -7,9.5 -4.6,1.6 -11,-3.5 -3.2,-3.5";

const TLBeadsLayer = memo(function TLBeadsLayer({ beads, handleBeadDown, handleBeadDoubleClick }: {
  beads: TimelineBead[];
  handleBeadDown(b: TimelineBead, e: React.PointerEvent): void;
  handleBeadDoubleClick(b: TimelineBead): void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {beads.map((b) => (
        <g key={b.id} data-testid="tl-bead" data-bead-id={b.id} data-origin={b.origin ? "true" : "false"} className="tl-bead"
          onPointerDown={(e) => handleBeadDown(b, e)}
          onDoubleClick={() => handleBeadDoubleClick(b)}
          transform={`translate(${b.x}, ${b.y})`}>
          {b.entryId ? <title>{t("timeline.panel.opensInCodex")}</title> : null}
          <line x1={0} y1={0} x2={0} y2={WIRE_Y - b.y} className="tl-bead-stem [stroke:var(--line)] [stroke-width:1.5]" />
          {b.origin ? (
            <>
              <polygon points={STAR_POINTS} fill="#c9a227" className="tl-bead-dot cursor-pointer" data-testid="tl-origin" />
              <text x={0} y={-22} className="tl-bead-label text-sm fill-gold font-semibold" textAnchor="middle">{b.label}</text>
            </>
          ) : (
            <>
              <circle cx={0} cy={0} r={8} fill={b.color} className="tl-bead-dot cursor-pointer" />
              <text x={0} y={-18} className="tl-bead-label text-sm fill-parchment font-semibold" textAnchor="middle">{b.label}</text>
              {b.dateText ? <text x={0} y={-34} className="tl-bead-date text-[11px] fill-gold font-mono" textAnchor="middle">{b.dateText}</text> : null}
              {b.summary ? <text x={0} y={14} className="tl-bead-summary text-[0.6875rem] fill-slate" textAnchor="middle">{b.summary.slice(0, 40)}</text> : null}
            </>
          )}
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
  const timeline = useWriteme((s) => (s.timelines ?? []).find((t) => t.id === timelineId));
  const pushToast = useWriteme((s) => s.pushToast);
  const pushTLHistory = useWriteme((s) => s.pushTLHistory);
  const flags = useWriteme(useShallow((s) => {
    const h = s.histories[`tl_${timelineId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  const stageRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const view = useRef({ s: 0.4, panX: 100, panY: 0 });
  const [, setDraw] = useState(0);
  // markDirty coalesced: a pointermove/wheel burst re-renders once per frame
  const markDirty = useRafCallback(() => setDraw((t) => t + 1));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const beadDrag = useRef<{ id: string; sx: number; beadX: number; startBeadY?: number } | null>(null);
  const eraDrag = useRef<{ id: string; sx: number; startX: number } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  // Coalesced drag: at most one store write per frame; pointerup flushes.
  const moveBeadRaf = useRafCallback((id: string, x: number, y: number) => {
    useWriteme.getState().moveBead(id, x, y);
  });

  useEffect(() => {
    if (!timeline) pushToast("error", t("timeline.page.notFound"));
  }, [timeline, pushToast, t]);

  const beads = timeline?.beads ?? [];
  const spans = useMemo(
    () => (timeline ? eraSpans(timeline.eras, beads, contentEnd(beads, timeline.eras)) : []),
    [timeline, beads],
  );

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
    for (const g of timeline.eras) {
      const x = eraStart(g, timeline.beads);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    if (minX === Infinity) return; // keep the default view for an empty wire
    const PAD = 80;
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

  const fitSpan = (span: EraSpan) => {
    const el = stageRef.current;
    if (!el || !el.clientWidth) return;
    const PAD = 60;
    const x0 = span.start - PAD, x1 = span.end + PAD;
    const s = Math.min(1, Math.max(0.1, el.clientWidth / (x1 - x0), el.clientHeight / 520));
    view.current = { s, panX: el.clientWidth / 2 - ((x0 + x1) / 2) * s, panY: el.clientHeight / 2 - WIRE_Y * s };
    markDirty.flush();
  };

  // Stable delegates for the memoized layers (resolved at event time).
  const layerHandlersRef = useRef<{
    beadDown(b: TimelineBead, e: React.PointerEvent): void;
    beadDoubleClick(b: TimelineBead): void;
    eraDown(span: EraSpan, e: React.PointerEvent): void;
    eraDoubleClick(span: EraSpan): void;
  } | null>(null);
  layerHandlersRef.current = {
    beadDown: (b, e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setSelectedId(b.id);
      // the start point is pinned: selecting it never arms a drag
      if (b.origin) return;
      beadDrag.current = { id: b.id, sx: e.clientX, beadX: b.x, startBeadY: b.y };
      pushTLHistory(timelineId);
    },
    beadDoubleClick: (b) => {
      if (!b.entryId) return;
      navigate(`/p/${timeline.projectId}/entries?e=${b.entryId}`);
    },
    eraDown: (span, e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setSelectedId(span.era.id);
      // a boundary tied to an event is dragged through the event bead
      if (span.era.boundaryBeadId) return;
      eraDrag.current = { id: span.era.id, sx: e.clientX, startX: span.start };
      pushTLHistory(timelineId);
    },
    eraDoubleClick: fitSpan,
  };
  const handleBeadDown = useCallback((b: TimelineBead, e: React.PointerEvent) => layerHandlersRef.current?.beadDown(b, e), []);
  const handleBeadDoubleClick = useCallback((b: TimelineBead) => layerHandlersRef.current?.beadDoubleClick(b), []);
  const handleEraDown = useCallback((span: EraSpan, e: React.PointerEvent) => layerHandlersRef.current?.eraDown(span, e), []);
  const handleEraDoubleClick = useCallback((span: EraSpan) => layerHandlersRef.current?.eraDoubleClick(span), []);

  const selectedEraId = selectedId && timeline.eras.some((g) => g.id === selectedId) ? selectedId : null;
  const selectedSpan = spans.find((s) => s.era.id === selectedEraId) ?? null;

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="timelinecanvas-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label={t("timeline.page.name")}
          value={timeline.name}
          onChange={(e) => useWriteme.getState().renameTimeline(timelineId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label={t("timeline.page.undo")} className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useWriteme.getState().undoTL(timelineId)}>↶</button>
          <button type="button" aria-label={t("timeline.page.redo")} className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useWriteme.getState().redoTL(timelineId)}>↷</button>
          <button type="button" aria-label={t("timeline.page.zoomOut")} className={BOARD_ACTION_BTN} onClick={() => { view.current = zoomAt({ ...view.current }, 1 / 1.25, elWidth() / 2, elHeight() / 2); markDirty.flush(); }}>−</button>
          <span className="text-slate text-xs font-mono self-center" data-testid="tlc-zoom">{Math.round(view.current.s * 100)}%</span>
          <button type="button" aria-label={t("timeline.page.zoomIn")} className={BOARD_ACTION_BTN} onClick={() => { view.current = zoomAt({ ...view.current }, 1.25, elWidth() / 2, elHeight() / 2); markDirty.flush(); }}>+</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => fitToContentNow()}>{t("timeline.page.fit")}</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => {
            pushTLHistory(timelineId);
            const x = (elWidth() / 2 - view.current.panX) / view.current.s;
            const created = useWriteme.getState().addBead(timelineId, { x, y: -60 });
            if (created) { setSelectedId(created.id); markDirty.flush(); }
          }}>{t("timeline.page.addEvent")}</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => {
            const x = (elWidth() / 2 - view.current.panX) / view.current.s;
            const created = useWriteme.getState().addEra(timelineId, x);
            if (created) { setSelectedId(created.id); markDirty.flush(); }
            else pushToast("error", t("timeline.panel.eraTooClose"));
          }}>{t("timeline.page.addEra")}</button>
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
            if ((e.target as Element).closest(".tl-bead") || (e.target as Element).closest(".tl-era")) return;
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
            const g = eraDrag.current;
            if (g) {
              useWriteme.getState().moveEraBoundary(g.id, g.startX + (e.clientX - g.sx) / view.current.s);
              markDirty();
              return;
            }
            const p = pan.current;
            if (p) {
              view.current = { ...view.current, panX: p.basePanX + (e.clientX - p.x), panY: p.basePanY + (e.clientY - p.y) };
              markDirty();
            }
          }}
          onPointerUp={() => { moveBeadRaf.flush(); beadDrag.current = null; eraDrag.current = null; pan.current = null; markDirty.flush(); }}
        >
          <div
            className="absolute bg-[radial-gradient(circle_at_25%_25%,#1d1611,var(--ink)_65%)] shadow-[inset_0_0_0_1px_var(--line)]"
            data-testid="tl-plane"
            style={{
              width: 20000, height: 20000,
              transform: `translate(${view.current.panX}px, ${view.current.panY}px) scale(${view.current.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="tl-wire-svg" className="edges-layer overflow-visible absolute left-2 top-2 w-full h-full pointer-events-none [&_.tl-bead]:pointer-events-auto [&_.tl-era]:pointer-events-auto" width="100%" height="100%">
              <line data-testid="tl-wire-base" x1={0} y1={WIRE_Y} x2={20000} y2={WIRE_Y} className="tl-wire-base [stroke:var(--gold-dim)] [stroke-width:3]" />
              {/* eras paint as bands over the wire; each ends where the next starts */}
              <TLSegmentsLayer spans={spans} zoom={view.current.s} selectedId={selectedEraId} handleEraDown={handleEraDown} handleEraDoubleClick={handleEraDoubleClick} />
              {selectedSpan && !selectedSpan.era.boundaryBeadId ? (
                <g data-testid="tl-era-handle" className="cursor-ew-resize"
                  onPointerDown={(e) => layerHandlersRef.current?.eraDown(selectedSpan, e)}>
                  <circle cx={selectedSpan.start} cy={WIRE_Y} r={9} fill="var(--ink)" stroke={selectedSpan.era.lineColor} strokeWidth={3} />
                </g>
              ) : null}
              <TLBeadsLayer beads={timeline.beads} handleBeadDown={handleBeadDown} handleBeadDoubleClick={handleBeadDoubleClick} />
            </svg>
          </div>
          {timeline.beads.filter((b) => !b.origin).length === 0 ? (
            <div className="board-empty-hint absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate">{t("timeline.page.emptyHint")}</div>
          ) : null}
          {notesOpen ? <TLNotepad notes={timeline.notes} onNotes={(v) => useWriteme.getState().setTimelineNotes(timelineId, v)} onClose={() => setNotesOpen(false)} /> : null}
          {/* invisible selection guard for tests */}
          <div className="tl-selected-sentinel" data-selected-bead={selectedId ?? ""} style={{ display: "none" }} />
        </div>
        <BeadPanel timeline={timeline} spans={spans} selectedId={selectedId} onSelect={setSelectedId} />
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
  const entries = useWriteme(useShallow((s) => s.entries.filter((e) => e.projectId === timeline.projectId)));
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
        onPick={(id) => useWriteme.getState().updateBead(bead.id, { entryId: id })}
        onClear={() => useWriteme.getState().updateBead(bead.id, { entryId: undefined })}
      />
    </div>
  );
}

function CalendarEventLink({ projectId, bead }: { projectId: string; bead: TimelineBead }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const calendars = useWriteme(useShallow((s) => (s.calendars ?? []).filter((c) => c.projectId === projectId)));
  const options = useMemo(() => {
    const out: { ref: CalendarEventRef; label: string }[] = [];
    for (const cal of calendars) {
      for (const [dayKey, events] of Object.entries(cal.events)) {
        const [, m, d] = dayKey.split(":").map(Number);
        const month = cal.months[m]?.name ?? "";
        for (const ev of events) out.push({ ref: { calendarId: cal.id, dayKey, eventId: ev.id }, label: `${ev.text} — ${d + 1} ${month}` });
      }
    }
    return out;
  }, [calendars]);

  const ref = bead.calendarEvent ?? null;
  if (options.length === 0 && !ref) return null;
  const current = options.find((o) => o.ref.calendarId === ref?.calendarId && o.ref.dayKey === ref?.dayKey && o.ref.eventId === ref?.eventId);

  return (
    <div className="flex flex-col gap-1.5" data-testid="bead-calendar-link">
      <Field label={t("timeline.panel.calendarEvent")}>
        <select
          className="rounded-sm border border-line bg-ink px-2.5 py-2 text-[15px] text-parchment outline-none"
          aria-label={t("timeline.panel.calendarEvent")}
          value={ref ? `${ref.calendarId}|${ref.dayKey}|${ref.eventId}` : ""}
          onChange={(e) => {
            const [calendarId, dayKey, eventId] = e.target.value.split("|");
            if (!calendarId) { useWriteme.getState().updateBead(bead.id, { calendarEvent: undefined }); return; }
            useWriteme.getState().updateBead(bead.id, { calendarEvent: { calendarId, dayKey, eventId } });
          }}
        >
          <option value="">{t("timeline.panel.pickCalendarEvent")}</option>
          {options.map((o) => (
            <option key={`${o.ref.calendarId}|${o.ref.dayKey}|${o.ref.eventId}`} value={`${o.ref.calendarId}|${o.ref.dayKey}|${o.ref.eventId}`}>{o.label}</option>
          ))}
        </select>
      </Field>
      {ref && !current ? (
        <p className="text-xs text-slate">{t("timeline.panel.eventRemoved")}</p>
      ) : null}
      {ref && current ? (
        <Button kind="ghost" className="justify-self-start px-2 py-1 text-xs" onClick={() => navigate(`/p/${projectId}/calendar/${ref.calendarId}?d=${ref.dayKey}`)}>
          {t("timeline.panel.openInCalendar")}
        </Button>
      ) : null}
    </div>
  );
}

function EraPanel({ timeline, span }: {
  timeline: TimelineWire;
  span: EraSpan;
}) {
  const { t } = useTranslation();
  const store = useWriteme.getState;
  const events = timeline.beads.filter((b) => !b.origin);
  const bound = span.era.boundaryBeadId ? timeline.beads.find((b) => b.id === span.era.boundaryBeadId) : null;
  return (
    <>
      <Field label={t("timeline.panel.eraName")}>
        <input aria-label={t("timeline.panel.eraName")} defaultValue={span.era.label}
          onBlur={(e) => store().updateEra(span.era.id, { label: e.target.value })} />
      </Field>
      <Field label={t("timeline.panel.eraLineColor")}>
        <input type="color" aria-label={t("timeline.panel.eraLineColor")} defaultValue={span.era.lineColor}
          onBlur={(e) => store().updateEra(span.era.id, { lineColor: e.target.value })} className="h-9 w-full bg-ink border border-line rounded-sm" />
      </Field>
      <Field label={t("timeline.panel.startsAt")}>
        <input readOnly aria-label={t("timeline.panel.startsAt")} value={bound ? bound.dateText ?? bound.label : String(Math.round(span.start))} className="text-parchment-dim" />
      </Field>
      <Field label={t("timeline.panel.boundaryEvent")}>
        <select
          className="rounded-sm border border-line bg-ink px-2.5 py-2 text-[15px] text-parchment outline-none"
          aria-label={t("timeline.panel.boundaryEvent")}
          value={span.era.boundaryBeadId ?? ""}
          onChange={(e) => {
            if (!e.target.value) { store().bindEraBoundary(span.era.id, null); return; }
            store().bindEraBoundary(span.era.id, e.target.value);
          }}
        >
          <option value="">{t("timeline.panel.pickBoundary")}</option>
          {events.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </Field>
      <p className="text-xs text-slate">{t("timeline.panel.eventsInEra", { count: events.filter((b) => b.x >= span.start && b.x < span.end).length })}</p>
    </>
  );
}

function BeadPanel({ timeline, spans, selectedId, onSelect }: {
  timeline: TimelineWire;
  spans: EraSpan[];
  selectedId: string | null;
  onSelect(id: string | null): void;
}) {
  const { t } = useTranslation();
  const store = useWriteme.getState;
  const pushToast = useWriteme((s) => s.pushToast);
  const navigate = useNavigate();
  const bead = timeline.beads.find((b) => b.id === selectedId);
  const span = spans.find((s) => s.era.id === selectedId);
  const [armDelete, setArmDelete] = useState(false);

  if (!bead && !span) {
    return (
      <aside className={BOARD_PANEL} data-testid="tl-panel">
        <p className={BOARD_PANEL_HINT}>{t("timeline.panel.selectHint")}</p>
      </aside>
    );
  }

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    if (bead) { store().deleteBead(bead.id); pushToast("success", t("timeline.panel.eventDeleted")); }
    if (span) { store().deleteEra(span.era.id); pushToast("success", t("timeline.panel.eraDeleted")); }
    onSelect(null);
  };

  // an era marked as boundary of an event: the toggle mirrors the binding
  const beadEra = bead && !bead.origin ? timeline.eras.find((g) => g.boundaryBeadId === bead.id) : undefined;

  return (
    <aside className={BOARD_PANEL} data-testid="tl-panel">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{bead?.label ?? span?.era.label}</h2>
        {bead?.origin ? null : (
          <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={remove}
            aria-label={armDelete ? t("timeline.panel.confirmDelete") : t("timeline.panel.delete")}>
            {armDelete ? t("common.confirm") : t("timeline.panel.delete")}
          </Button>
        )}
      </header>
      {span ? (
        <EraPanel timeline={timeline} span={span} />
      ) : null}
      {bead ? (
        <>
          <Field label={t("timeline.panel.label")}>
            <input aria-label={t("timeline.panel.eventLabel")} defaultValue={bead.label}
              onBlur={(e) => store().updateBead(bead.id, { label: e.target.value })} />
          </Field>
          {bead.origin ? (
            <p className="text-xs text-slate" data-testid="tl-origin-hint">{t("timeline.panel.originHint")}</p>
          ) : null}
          {bead.origin ? null : (
            <>
              <Field label={t("timeline.panel.date")}>
                <input aria-label={t("timeline.panel.eventDate")} defaultValue={bead.dateText ?? ""}
                  onBlur={(e) => store().updateBead(bead.id, { dateText: e.target.value.trim() || undefined })} />
              </Field>
              <Field label={t("timeline.panel.summary")}>
                <textarea aria-label={t("timeline.panel.eventSummary")} rows={3} defaultValue={bead.summary ?? ""}
                  onBlur={(e) => store().updateBead(bead.id, { summary: e.target.value.trim() || undefined })} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-parchment-dim">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--gold)]"
                  aria-label={t("timeline.panel.startsAnEra")}
                  checked={!!beadEra}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const created = store().addEra(timeline.id, bead.x, bead.label);
                      if (!created) { pushToast("error", t("timeline.panel.eraTooClose")); return; }
                      store().bindEraBoundary(created.id, bead.id);
                    } else if (beadEra) {
                      store().deleteEra(beadEra.id);
                    }
                  }}
                />
                {t("timeline.panel.startsAnEra")}
              </label>
              <TomeEntryLink timeline={timeline} bead={bead} onNavigate={(entryId) => navigate(`/p/${timeline.projectId}/entries?e=${entryId}`)} />
              <CalendarEventLink projectId={timeline.projectId} bead={bead} />
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
          )}
        </>
      ) : null}
    </aside>
  );
}
