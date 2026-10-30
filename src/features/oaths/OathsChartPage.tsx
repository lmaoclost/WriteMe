import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useWriteme } from "../../data/store";
import { tidyOathsChart } from "../../domain/oaths";
import type { OathsChart, OathLink } from "../../domain/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";
import { useBoardNotesHotkey } from "../../ui/boardNotes";
import { withCurrentColor } from "../../ui/colors";
import { useRafState, useRafCallback } from "../../ui/useRaf";


export const OATH_LINK_STYLE = {
  sworn: { label: "Sworn", labelKey: "oaths.link.sworn", color: "#7c5cbf", dash: "" },
  strained: { label: "Strained", labelKey: "oaths.link.strained", color: "#d4a017", dash: "7 5" },
  broken: { label: "Broken", labelKey: "oaths.link.broken", color: "#c0392b", dash: "10 6" },
} as const satisfies Record<OathLink["status"], { label: string; labelKey: string; color: string; dash: string }>;

export const OATH_MEMBER_COLORS = [
  "#c0392b", "#e74c3c", "#e67e22", "#f1c40f", "#27ae60", "#2ecc71",
  "#2980b9", "#3498db", "#7c5cbf", "#8e44ad", "#2c3e50", "#34495e",
];

const OathsLinksLayer = memo(function OathsLinksLayer({ links, pos }: {
  links: OathLink[];
  pos: Map<string, { x: number; y: number }>;
}) {
  const { t } = useTranslation();
  return (
    <>
      {links.map((l: OathLink) => {
        const child = pos.get(l.subordinateId);
        const parent = pos.get(l.superiorId);
        if (!child || !parent) return null;
        const style = OATH_LINK_STYLE[l.status];
        const elbowY = parent.y + (child.y - parent.y) * 0.55;
        return (
          <g key={l.id}>
            <path
              data-testid="oath-link"
              className={"oath-link" + (l.kind === "joint" ? " oath-joint" : "")}
              d={`M ${parent.x} ${parent.y + 24} L ${parent.x} ${elbowY} L ${child.x} ${elbowY} L ${child.x} ${child.y - 24}`}
              stroke={style.color}
              strokeWidth={l.kind === "joint" ? 2 : 2.6}
              strokeDasharray={style.dash}
              fill="none"
            />
            <text x={child.x} y={elbowY - 4} className="oath-link-status" fill={style.color} textAnchor="middle">
              {t(style.labelKey)}
              {l.kind === "joint" ? ` ${t("oaths.link.jointSuffix")}` : ""}
            </text>
          </g>
        );
      })}
    </>
  );
});

const OathsCardsLayer = memo(function OathsCardsLayer({ members, pos, selectedId, handleCardDown, handleCardClick, handleConnectDown }: {
  members: OathsChart["members"];
  pos: Map<string, { x: number; y: number }>;
  selectedId: string | null;
  handleCardDown(m: { id: string }, e: React.PointerEvent): void;
  handleCardClick(id: string): void;
  handleConnectDown(id: string): void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {members.map((m) => {
        const p = pos.get(m.id);
        if (!p) return null;
        return (
          <div
            key={m.id}
            className={"oath-card conn-anchor absolute w-[180px] px-3 py-2.5 rounded-lg bg-night border border-slate grid gap-[3px] cursor-pointer" + (m.id === selectedId ? " outline outline-2 outline-gold" : "") + (m.seatStatus !== "held" ? " seat-" + m.seatStatus : "") + (m.seatStatus === "vacant" ? " border-dashed opacity-85" : "") + (m.seatStatus === "disputed" ? " border-[var(--ember)]" : "")}
            data-testid="oath-member"
            data-member-id={m.id}
            style={{ left: p.x - 90, top: p.y - 24 }}
            role="button"
            aria-label={t("oaths.chart.memberNode", { name: m.name })}
            tabIndex={0}
            onPointerDown={(e) => handleCardDown(m, e)}
            onClick={() => handleCardClick(m.id)}
          >
            <span className="text-sm font-semibold text-parchment">{m.name}</span>
            {m.title ? <span className="text-[11px] text-parchment-dim">{m.title}</span> : null}
            {m.org ? <span className="text-[11px] text-slate">{m.org}</span> : null}
            <span className={"oath-seat-badge w-max rounded-sm px-1 py-px text-[0.6875rem] bg-ink text-slate" + (m.seatStatus === "disputed" ? " text-[var(--ember)]" : "")}>
              {m.seatStatus === "held" ? t("oaths.seat.held") : m.seatStatus === "vacant" ? t("oaths.seat.vacant") : t("oaths.seat.disputed")}
            </span>
            <button
              type="button"
              className="conn-handle absolute -right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-gold text-wax border-0 text-[0.6875rem] grid place-items-center cursor-crosshair"
              aria-label={t("oaths.chart.connect", { name: m.name })}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.button !== 0) return;
                handleConnectDown(m.id);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
            >●</button>
          </div>
        );
      })}
    </>
  );
});

export function OathsChartPage({ chartId }: { chartId: string }) {
  const { t } = useTranslation();
  const chart = useWriteme((s) => (s.oathsCharts ?? []).find((c) => c.id === chartId));
  const pushToast = useWriteme((s) => s.pushToast);
  const flags = useWriteme(useShallow((s) => {
    const h = s.histories[`oc_${chartId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, scheduleScale] = useRafState({ s: 0.1, panX: 0, panY: 0 });
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // Coalesced drag: at most one moveOathMember per frame, latest position
  // wins; flush() commits the final position when the pointer lifts.
  const moveMemberRaf = useRafCallback((id: string, x: number, y: number) => {
    useWriteme.getState().moveOathMember(id, x, y);
  });

  useEffect(() => {
    if (!chart) pushToast("error", t("oaths.chart.notFound"));
  }, [chart, pushToast, t]);

  // Structural key: the solver only reads hierarchy (ids/link order), never
  // manual positions — so a drag tick re-merges positions but never re-solves.
  const memberKey = useMemo(() => (chart?.members ?? []).map((m) => m.id).join("|"), [chart?.members]);
  const linkKey = useMemo(
    () => (chart?.oathLinks ?? []).map((l) => `${l.superiorId}>${l.subordinateId}`).join("|"),
    [chart?.oathLinks],
  );
  const solvedBase = useMemo(
    () => tidyOathsChart(chart?.members ?? [], chart?.oathLinks ?? [], { rootX: 240, rootY: 120, levelH: 170 }),
    // chart?.members/chart?.oathLinks are read at the render where the key changes;
    // the solver only consumes ids and link order, so those keys fully determine its output
    [memberKey, linkKey],
  );
  const pos = useMemo(() => {
    const merged = new Map(solvedBase);
    for (const m of chart?.members ?? []) {
      if (m.x != null && m.y != null) merged.set(m.id, { x: m.x, y: m.y });
    }
    return merged;
  }, [solvedBase, chart?.members]);

  const planeSize = useMemo(() => {
    let size = 20000;
    for (const p of pos.values()) size = Math.max(size, p.x + 4000, p.y + 4000);
    return Math.ceil(size / 10000) * 10000;
  }, [pos]);

  const elWidth = () => stageRef.current?.clientWidth ?? 1200;
  const elHeight = () => stageRef.current?.clientHeight ?? 800;

  const fitToContentNow = () => {
    const el = stageRef.current;
    if (!el || !el.clientWidth || pos.size === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pos.values()) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const MIN_SPAN = 600;
    const bw = Math.max(maxX - minX, MIN_SPAN);
    const bh = Math.max(maxY - minY, MIN_SPAN);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const s = Math.min(1, Math.min(el.clientWidth / bw, el.clientHeight / bh) * 0.85);
    scheduleScale({ s, panX: el.clientWidth / 2 - cx * s, panY: el.clientHeight / 2 - cy * s });
    scheduleScale.flush(); // single-shot fit: commit synchronously
  };

  // center-ish default view — fit the CONTENT (members), capped at scale 1
  useEffect(() => {
    fitToContentNow();
    // run once per chart mount; deps intentionally just chartId
  }, [chartId]);

  const zoomAt = (v: { s: number; panX: number; panY: number }, factor: number, cx: number, cy: number) => {
    const s = Math.min(8, Math.max(0.05, v.s * factor));
    const relX = (cx - v.panX) / v.s;
    const relY = (cy - v.panY) / v.s;
    return { s, panX: cx - relX * s, panY: cy - relY * s };
  };

  // Wheel zoom runs on a native non-passive listener: React attaches wheel
  // at the root with passive:true, so preventDefault in onWheel is a no-op
  // and the browser scrolls/pinches the page while the canvas zooms.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      scheduleScale((v) => {
        const s = Math.min(8, Math.max(0.02, v.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        const relX = (sx - v.panX) / v.s, relY = (sy - v.panY) / v.s;
        return { s, panX: sx - relX * s, panY: sy - relY * s };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [scheduleScale]);

  const onCanvasMove = (e: React.PointerEvent) => {
    if (pendingFrom && stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      return;
    }
    if (pan.current) {
      const p = pan.current;
      const nextPanX = p.basePanX + (e.clientX - p.x);
      const nextPanY = p.basePanY + (e.clientY - p.y);
      scheduleScale((v) => (v.panX === nextPanX && v.panY === nextPanY ? v : { ...v, panX: nextPanX, panY: nextPanY }));
    }
  };

  const onCanvasDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as Element;
    if (t.closest(".oath-card") || t.closest(".conn-handle")) return;
    if (pendingFrom) { setPendingFrom(null); setCursor(null); return; }
    pan.current = { x: e.clientX, y: e.clientY, basePanX: scale.panX, basePanY: scale.panY };
  };

  const onPointerUp = () => { pan.current = null; };

  if (!chart) return null;

  // Stable delegates for the memoized card layer: closures are resolved
  // through a ref AT EVENT TIME, so a stale memo layer can never pin an old
  // pendingFrom/pos snapshot into a handler.
  const handleCardDown = useCallback((m: { id: string }, e: React.PointerEvent) => {
    cardHandlersRef.current.onCardDown(m)(e);
  }, []);
  const handleCardClick = useCallback((id: string) => cardHandlersRef.current.cardClick(id), []);
  const handleConnectDown = useCallback((id: string) => cardHandlersRef.current.connectDown(id), []);
  const connectTo = (targetId: string) => {
    if (!pendingFrom || pendingFrom === targetId) { setPendingFrom(null); setCursor(null); return; }
    useWriteme.getState().addOathLink(chart.id, targetId, pendingFrom); // subordinate = target, superior = origin
    setPendingFrom(null);
    setCursor(null);
  };

  const onCardDown = (m: { id: string }) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as Element;
    if (t.closest(".conn-handle")) return; // own handler
    if (pendingFrom) { connectTo(m.id); return; }
    e.stopPropagation();
    setSelectedId(m.id);
    const p = pos.get(m.id);
    if (!p) return;
    const start = { x: e.clientX, y: e.clientY };
    let pushed = false;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (Math.hypot(dx, dy) <= 5) return;
      if (!pushed) { useWriteme.getState().pushOCHistory(chartId); pushed = true; }
      moveMemberRaf(m.id, p.x + dx / scaleRef.current.s, p.y + dy / scaleRef.current.s);
    };
    const onUp = () => {
      moveMemberRaf.flush();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Stable delegates for the memoized card layer: closures are resolved
  // through a ref AT EVENT TIME, so a stale memo layer can never pin an old
  // pendingFrom/pos snapshot into a handler.
  const cardHandlersRef = useRef({ onCardDown, cardClick: connectTo, connectDown: connectTo });
  cardHandlersRef.current = {
    onCardDown,
    cardClick: (id: string) => { if (pendingFrom) connectTo(id); else setSelectedId(id); },
    connectDown: (id: string) => {
      if (!pendingFrom) { setPendingFrom(id); setCursor(null); }
      else connectTo(id);
    },
  };

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="oaths-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label={t("oaths.chart.name")}
          value={chart.name}
          onChange={(e) => useWriteme.getState().renameOathsChart(chartId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label={t("oaths.chart.undo")} className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useWriteme.getState().undoOC(chartId)}>↶</button>
          <button type="button" aria-label={t("oaths.chart.redo")} className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useWriteme.getState().redoOC(chartId)}>↷</button>
          <button type="button" aria-label={t("oaths.chart.zoomOut")} className={BOARD_ACTION_BTN} onClick={() => { scheduleScale((v) => zoomAt({ ...v }, 1 / 1.25, elWidth(), elHeight())); scheduleScale.flush(); }}>−</button>
          <span className="text-slate text-xs font-mono self-center" data-testid="oc-zoom">{Math.round(scale.s * 100)}%</span>
          <button type="button" aria-label={t("oaths.chart.zoomIn")} className={BOARD_ACTION_BTN} onClick={() => { scheduleScale((v) => zoomAt({ ...v }, 1.25, elWidth(), elHeight())); scheduleScale.flush(); }}>+</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => fitToContentNow()}>{t("oaths.chart.fit")}</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => {
            const rect = stageRef.current?.getBoundingClientRect();
            useWriteme.getState().pushOCHistory(chartId);
            const elW = elWidth();
            const elH = elHeight();
            const m = useWriteme.getState().addOathMember(chartId, undefined, { name: t("oaths.chart.defaultFounder") });
            if (m && rect) {
              const x = (elW / 2 - scaleRef.current.panX) / scaleRef.current.s;
              const y = (elH / 2 - scaleRef.current.panY) / scaleRef.current.s;
              useWriteme.getState().moveOathMember(m.id, x, y);
            }
            void m;
          }}>{t("oaths.chart.addFounder")}</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>{t("oaths.chart.notes")}</button>
        </div>
      </header>
      <div className="grid grid-cols-[1fr_300px] min-h-0 overflow-hidden">
        <div
          className="relative overflow-hidden bg-ink cursor-grab active:cursor-grabbing"
          data-testid="oaths-canvas"
          ref={stageRef}
          style={{ ...(pendingFrom ? { cursor: "crosshair" } : {}) }}
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={onPointerUp}
        >
          <div
            className="absolute top-0 left-0 bg-[radial-gradient(circle_at_25%_25%,#1d1611,var(--ink)_65%)] shadow-[inset_0_0_0_1px_var(--line)]"
            data-testid="oaths-plane"
            style={{
              width: planeSize,
              height: planeSize,
              transform: `translate(${scale.panX}px, ${scale.panY}px) scale(${scale.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="oaths-links" className="edges-layer absolute left-0 top-0 w-full h-full pointer-events-none" width="100%" height="100%">
              <OathsLinksLayer links={chart.oathLinks} pos={pos} />
              {pendingFrom ? (() => {
                const from = pos.get(pendingFrom);
                if (!from || !cursor) return null;
                return <line data-testid="pending-oath" x1={from.x} y1={from.y} x2={(cursor.x - scaleRef.current.panX) / scaleRef.current.s} y2={(cursor.y - scaleRef.current.panY) / scaleRef.current.s} className="[stroke:var(--gold)] [stroke-width:2] [stroke-dasharray:6_6]" />;
              })() : null}
            </svg>
            {chart.members.length > 0 ? (
              <OathsCardsLayer
                members={chart.members}
                pos={pos}
                selectedId={selectedId}
                handleCardDown={handleCardDown}
                handleCardClick={handleCardClick}
                handleConnectDown={handleConnectDown}
              />
            ) : null}
          </div>
          {chart.members.length === 0 ? (
            <div className="board-empty-hint absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate">{t("oaths.chart.emptyHint")}</div>
          ) : null}
          {pendingFrom ? (
            <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-night-2 border border-line text-parchment-dim px-3 py-1.5 rounded-lg text-[13px]">{t("oaths.chart.pickMember")}</div>
          ) : null}
          {notesOpen ? <OathsNotepadBridge notes={chart.notes} onNotes={(v) => useWriteme.getState().setOathsNotes(chartId, v)} onClose={() => setNotesOpen(false)} /> : null}
        </div>
        <OathsPanel chart={chart} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  );
}

function OathsPanel({ chart, selectedId, onSelect }: {
  chart: OathsChart;
  selectedId: string | null;
  onSelect(id: string | null): void;
}) {
  const { t } = useTranslation();
  const member = chart.members.find((m) => m.id === selectedId);
  if (!member) {
    return (
      <aside className={BOARD_PANEL} data-testid="oaths-panel">
        <p className={BOARD_PANEL_HINT}>{t("oaths.panel.selectHint")}</p>
      </aside>
    );
  }
  return <MemberForm chart={chart} member={member} onSelect={onSelect} />;
}

function MemberForm({ chart, member, onSelect }: {
  chart: OathsChart;
  member: OathsChart["members"][number];
  onSelect(id: string | null): void;
}) {
  const store = useWriteme.getState;
  const { t } = useTranslation();
  const pushToast = useWriteme((s) => s.pushToast);
  const [armDelete, setArmDelete] = useState(false);
  const update = (patch: Partial<OathsChart["members"][number]>) => store().updateOathMember(member.id, patch);

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deleteOathMember(member.id);
    pushToast("success", t("oaths.panel.memberRemoved"));
    onSelect(null);
  };

  const links = chart.oathLinks.filter((l) => l.subordinateId === member.id || l.superiorId === member.id);
  const superiors = links.filter((l) => l.subordinateId === member.id);
  const candidates = chart.members.filter((m) => m.id !== member.id);
  const nameById = useMemo(() => new Map(chart.members.map((m) => [m.id, m.name])), [chart.members]);
  const nameOf = (id: string): string => nameById.get(id) ?? "?";

  return (
    <aside className={BOARD_PANEL} data-testid="oaths-panel">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{member.name}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={remove}
          aria-label={armDelete ? t("oaths.panel.confirmDeleteMember") : t("common.delete")}>
          {armDelete ? t("common.confirm") : t("common.delete")}
        </Button>
      </header>
      <Field label={t("oaths.panel.name")}>
        <input aria-label={t("oaths.panel.memberName")} defaultValue={member.name} onBlur={(e) => update({ name: e.target.value.trim() || member.name })} />
      </Field>
      <Field label={t("oaths.panel.titleOffice")}>
        <input aria-label={t("oaths.panel.titleOffice")} defaultValue={member.title ?? ""} onBlur={(e) => update({ title: e.target.value.trim() || undefined })} />
      </Field>
      <Field label={t("oaths.panel.orderBranch")}>
        <input aria-label={t("oaths.panel.orderBranch")} defaultValue={member.org ?? ""} onBlur={(e) => update({ org: e.target.value.trim() || undefined })} />
      </Field>
      <Field label={t("oaths.panel.notes")}>
        <textarea aria-label={t("oaths.panel.memberNotes")} rows={3} defaultValue={member.notes ?? ""} onBlur={(e) => update({ notes: e.target.value.trim() || undefined })} />
      </Field>
      <Field label={t("oaths.panel.seat")}>
        <Select value={member.seatStatus} onValueChange={(v) => update({ seatStatus: v as unknown as OathsChart["members"][number]["seatStatus"] })}>
          <SelectTrigger aria-label={t("oaths.panel.seatStatus")} className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            <SelectItem value="held" className="text-xs focus:bg-accent focus:text-parchment">{t("oaths.seat.held")}</SelectItem>
            <SelectItem value="vacant" className="text-xs focus:bg-accent focus:text-parchment">{t("oaths.seat.vacant")}</SelectItem>
            <SelectItem value="disputed" className="text-xs focus:bg-accent focus:text-parchment">{t("oaths.seat.disputed")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("oaths.panel.color")}>
        <div className="flex flex-wrap gap-1.5" role="listbox" aria-label={t("oaths.panel.memberColor")}>
          {withCurrentColor(OATH_MEMBER_COLORS, member.color).map((c) => (
            <button key={c} type="button" role="option" aria-selected={member.color === c}
              className={`color-swatch size-5 rounded-full border border-transparent cursor-pointer${member.color === c ? " outline outline-2 outline-parchment" : ""}`} style={{ background: c }}
              onClick={() => update({ color: c })} />
          ))}
        </div>
      </Field>
      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3 className="text-[13px] tracking-[0.08em] uppercase text-slate font-semibold">{t("oaths.panel.directReports")}</h3>
        <button
          type="button"
          aria-label={t("oaths.panel.addDirectReport")}
          onClick={() => {
            store().addOathMember(chart.id, member.id, { name: t("oaths.panel.defaultVassal") });
          }}
        >+ {t("oaths.panel.swearOath")}</button>
        <Field label={t("oaths.panel.subordinateTo")}>
          <SubordinatePicker candidates={candidates} onPick={(id) => store().addOathLink(chart.id, member.id, id)} />
        </Field>
      </section>
      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3 className="text-[13px] tracking-[0.08em] uppercase text-slate font-semibold">{t("oaths.panel.theirOaths")}</h3>
        {links.length === 0 ? <p className="text-slate">{t("oaths.panel.noOaths")}</p> : null}
        {superiors.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-1.5" data-testid="oath-edit-row">
            <span className="text-slate">{t("oaths.panel.toward", { name: nameOf(l.superiorId) })}</span>
            <Select value={l.status} onValueChange={(v) => store().setOathStatus(l.id, v as unknown as OathLink["status"])}>
              <SelectTrigger aria-label={t("oaths.panel.statusOf", { name: nameOf(l.superiorId) })} className="h-auto justify-between rounded-sm border-line bg-ink px-1 py-0.5 text-[11px] text-parchment-dim hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                <SelectItem value="sworn" className="text-[11px] focus:bg-accent focus:text-parchment">{t("oaths.link.sworn")}</SelectItem>
                <SelectItem value="strained" className="text-[11px] focus:bg-accent focus:text-parchment">{t("oaths.link.strained")}</SelectItem>
                <SelectItem value="broken" className="text-[11px] focus:bg-accent focus:text-parchment">{t("oaths.link.broken")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={l.kind} onValueChange={(v) => store().setOathLinkKind(l.id, v as unknown as OathLink["kind"])}>
              <SelectTrigger aria-label={t("oaths.panel.kindOf", { name: nameOf(l.superiorId) })} className="h-auto justify-between rounded-sm border-line bg-ink px-1 py-0.5 text-[11px] text-parchment-dim hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                <SelectItem value="primary" className="text-[11px] focus:bg-accent focus:text-parchment">{t("oaths.panel.primaryChain")}</SelectItem>
                <SelectItem value="joint" className="text-[11px] focus:bg-accent focus:text-parchment">{t("oaths.panel.jointReport")}</SelectItem>
              </SelectContent>
            </Select>
            <button type="button" aria-label={t("oaths.panel.removeOathLink")} onClick={() => store().removeOathLink(l.id)} className="bg-none border-0 text-slate text-xs">✕</button>
          </div>
        ))}
      </section>
    </aside>
  );
}

function SubordinatePicker({ candidates, onPick }: {
  candidates: OathsChart["members"];
  onPick(id: string): void;
}) {
  const { t } = useTranslation();
  const [pick, setPick] = useState("");
  return (
    <Select value={pick} onValueChange={(v) => { if (v) { onPick(v); setPick(""); } }}>
      <SelectTrigger aria-label={t("oaths.panel.subordinateTo")} className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment-dim hover:border-gold-dim data-[size=default]:h-auto">
        <SelectValue placeholder={t("oaths.panel.subordinatePlaceholder")} />
      </SelectTrigger>
      <SelectContent className="border-line bg-night text-parchment">
        {candidates.map((c) => (
          <SelectItem key={c.id} value={c.id} className="text-xs focus:bg-accent focus:text-parchment" data-testid="subordinate-option">{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function OathsNotepadBridge({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  return <OathsNotepad notes={notes} onNotes={onNotes} onClose={onClose} />;
}

import { OathsNotepad } from "./OathsNotepad";
