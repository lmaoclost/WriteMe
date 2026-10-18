import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { FACTION_CONNECTION_STYLES } from "./connectionStyles";
import { FactionPanel } from "./FactionPanel";
import { WebNotepad } from "./WebNotepad";
import type { Faction, FactionConnection } from "../../domain/types";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN } from "../../ui/board";
import { useBoardNotesHotkey } from "../../ui/boardNotes";
import { useRafState, useRafCallback } from "../../ui/useRaf";

const FEdgesLayer = memo(function FEdgesLayer({ connections, facById }: {
  connections: FactionConnection[];
  facById: Map<string, Faction>;
}) {
  return (
    <>
      {connections.map((c) => {
        const a = facById.get(c.fromId);
        const b = facById.get(c.toId);
        if (!a || !b) return null;
        const style = FACTION_CONNECTION_STYLES[c.type];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={c.id}>
            <line
              data-testid={`edge-${c.type}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={style.color}
              strokeWidth={2}
              strokeDasharray={style.dashArray}
            />
            <text x={mx} y={my - 6} className="text-[11px] font-mono" fill={style.color} textAnchor="middle">{style.label}</text>
          </g>
        );
      })}
    </>
  );
});

const FNodesLayer = memo(function FNodesLayer({ factions, selectedId, handleNodeDown, handleNodeClick, handleConnectDown }: {
  factions: Faction[];
  selectedId: string | null;
  handleNodeDown(f: Faction, e: React.PointerEvent): void;
  handleNodeClick(f: Faction): void;
  handleConnectDown(f: Faction, e: React.PointerEvent): void;
}) {
  return (
    <>
      {factions.map((f) => (
        <div
          key={f.id}
          className={`fac-node absolute w-[120px] px-2.5 py-2 rounded-lg bg-night border border-slate border-t-3 grid gap-0.5 cursor-pointer${selectedId === f.id ? " outline outline-2 outline-gold" : ""}`}
          data-fac-id={f.id}
          data-testid="fac-node"
          style={{ left: f.x - 60, top: f.y - 22, borderTopColor: f.color }}
          onPointerDown={(e) => handleNodeDown(f, e)}
          onClick={() => handleNodeClick(f)}
          role="button"
          aria-label={`Faction ${f.name}`}
          tabIndex={0}
        >
          <span className="absolute size-2.5 rounded-full -left-1.5 -top-1.5" style={{ background: f.color }} />
          <span className="text-[13px] font-semibold text-parchment">{f.name}</span>
          {f.leader ? <span className="text-[11px] text-slate">{f.leader}</span> : null}
          <button
            type="button"
            className="conn-handle absolute -right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-gold text-wax border-0 text-[0.6875rem] grid place-items-center cursor-crosshair"
            aria-label={`Conectar ${f.name}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => handleConnectDown(f, e)}
          >
            ●
          </button>
        </div>
      ))}
    </>
  );
});


export function FactionWebPage({ webId }: { webId: string }) {
  const web = useScriptorium((s) => (s.factionWebs ?? []).find((w) => w.id === webId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const pushFWHistory = useScriptorium((s) => s.pushFWHistory);
  const addFaction = useScriptorium((s) => s.addFaction);
  const addConnection = useScriptorium((s) => s.addConnection);
  const setConnectionType = useScriptorium((s) => s.setConnectionType);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`fw_${webId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, scheduleScale] = useRafState({ s: 0.1, panX: 0, panY: 0 });
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const [pendingFrom, setPendingFrom] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [typePicker, setTypePicker] = useState<{ connId: string; left: number; top: number } | null>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; baseX: number; baseY: number; pushed: boolean } | null>(null);

  // Coalesced drag: at most one moveFaction per frame; pointerup flushes.
  const moveFactionRaf = useRafCallback((id: string, x: number, y: number) => {
    useScriptorium.getState().moveFaction(id, x, y);
  });

  useEffect(() => {
    if (!web) pushToast("error", "Faction web not found.");
  }, [web, pushToast]);

  const planeSize = useMemo(() => {
    let size = 20000;
    for (const f of web?.factions ?? []) size = Math.max(size, f.x + 4000, f.y + 4000);
    return Math.ceil(size / 10000) * 10000;
  }, [web?.factions]);

  const facById = useMemo(() => new Map((web?.factions ?? []).map((f) => [f.id, f])), [web?.factions]);

  const fitToContentNow = () => {
    const el = stageRef.current;
    if (!el || !el.clientWidth || !web?.factions.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of web.factions) {
      if (f.x < minX) minX = f.x;
      if (f.x > maxX) maxX = f.x;
      if (f.y < minY) minY = f.y;
      if (f.y > maxY) maxY = f.y;
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

  // center-ish default view — fit the CONTENT (factions), capped at scale 1
  useEffect(() => {
    fitToContentNow();
    // run once per web mount
  }, [webId]);

  const elWidth = () => stageRef.current?.clientWidth ?? 1200;
  const elHeight = () => stageRef.current?.clientHeight ?? 800;
  const zoomAt = (v: { s: number; panX: number; panY: number }, factor: number, cx: number, cy: number) => {
    const s = Math.min(8, Math.max(0.05, v.s * factor));
    const relX = (cx - v.panX) / v.s;
    const relY = (cy - v.panY) / v.s;
    return { s, panX: cx - relX * s, panY: cy - relY * s };
  };
  const adjustView = () => {
    fitToContentNow();
  };

  // Wheel zoom on a native non-passive listener (React onWheel is passive at
  // the root); pan/drag update scale through the frame-coalesced setter.
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
      scheduleScale.flush(); // wheel fires at frame rate; keep zoom commits synchronous
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [scheduleScale]);

  if (!web) return null;

  const onCanvasMove = (e: React.PointerEvent) => {
    if (pendingFrom) {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect) setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      return;
    }
    if (drag.current) {
      const d = drag.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.hypot(dx, dy) > 5) {
        if (!d.pushed) { pushFWHistory(webId); d.pushed = true; }
        moveFactionRaf(d.id, d.baseX + dx / scaleRef.current.s, d.baseY + dy / scaleRef.current.s);
      }
      return;
    }
    // pan
    if (pan.current) {
      const p = pan.current;
      const panX = p.basePanX + (e.clientX - p.x);
      const panY = p.basePanY + (e.clientY - p.y);
      scheduleScale((v) => (v.panX === panX && v.panY === panY ? v : { ...v, panX, panY }));
    }
  };
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  const onNodeClick = (f: Faction) => {
    if (pendingFrom && pendingFrom.id !== f.id) {
      const conn = addConnection(webId, pendingFrom.id, f.id);
      setPendingFrom(null);
      setCursor(null);
      if (conn) {
        const from = facById.get(conn.fromId);
        const to = facById.get(conn.toId);
        if (from && to) {
          const rect = stageRef.current?.getBoundingClientRect();
          if (rect) {
            const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
            setTypePicker({
              connId: conn.id,
              left: rect.left + scaleRef.current.panX + mid.x * scaleRef.current.s,
              top: rect.top + scaleRef.current.panY + mid.y * scaleRef.current.s,
            });
          }
        }
      }
    } else if (!pendingFrom) {
      setSelectedId(f.id);
    }
  };

  // Stable delegates for the memoized node layer (resolved at event time).
  const nodeHandlersRef = useRef<{
    nodeDown(f: Faction, e: React.PointerEvent): void;
    nodeClick(f: Faction): void;
    connectDown(f: Faction, e: React.PointerEvent): void;
  } | null>(null);
  nodeHandlersRef.current = {
    nodeDown: (f, e) => {
      const d = e.target as Element;
      if (d.closest(".conn-handle")) { (e.target as HTMLElement).dataset.startConn = "1"; return; }
      if (pendingFrom) { onNodeClick(f); return; }
      setSelectedId(f.id);
      drag.current = { id: f.id, startX: e.clientX, startY: e.clientY, baseX: f.x, baseY: f.y, pushed: false };
    },
    nodeClick: (f) => { if (pendingFrom) onNodeClick(f); },
    connectDown: (f, e) => {
      e.stopPropagation();
      if (!pendingFrom) {
        setPendingFrom({ id: f.id, x: e.clientX, y: e.clientY });
      } else {
        onNodeClick(f);
      }
    },
  };
  const handleNodeDown = useCallback((f: Faction, e: React.PointerEvent) => nodeHandlersRef.current?.nodeDown(f, e), []);
  const handleNodeClick = useCallback((f: Faction) => nodeHandlersRef.current?.nodeClick(f), []);
  const handleConnectDown = useCallback((f: Faction, e: React.PointerEvent) => nodeHandlersRef.current?.connectDown(f, e), []);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="factions-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label="Faction web name"
          value={web.name}
          onChange={(e) => useScriptorium.getState().renameFactionWeb(webId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label="Undo" className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoFW(webId)}>↶</button>
          <button type="button" aria-label="Redo" className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoFW(webId)}>↷</button>
          <button type="button" aria-label="Zoom out" className={BOARD_ACTION_BTN} onClick={() => { scheduleScale((v) => zoomAt({ ...v }, 1 / 1.25, elWidth(), elHeight())); scheduleScale.flush(); }}>−</button>
          <span className="text-slate text-xs font-mono self-center" data-testid="fw-zoom">{Math.round(scale.s * 100)}%</span>
          <button type="button" aria-label="Zoom in" className={BOARD_ACTION_BTN} onClick={() => { scheduleScale((v) => zoomAt({ ...v }, 1.25, elWidth(), elHeight())); scheduleScale.flush(); }}>+</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => adjustView()}>Ajustar</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => { pushFWHistory(webId); const el = stageRef.current; const f = addFaction(webId, { x: el ? (el.clientWidth / 2 - scaleRef.current.panX) / scaleRef.current.s : 4000, y: el ? (el.clientHeight / 2 - scaleRef.current.panY) / scaleRef.current.s : 4000 }); if (f) setSelectedId(f.id); }}>
            New Faction
          </button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>Notes ✎</button>
        </div>
      </header>
      <div className="grid grid-cols-[1fr_300px] min-h-0 overflow-hidden">
        <div
          className="relative overflow-hidden bg-ink cursor-grab active:cursor-grabbing"
          data-testid="fw-canvas"
          ref={stageRef}
          style={{ ...(pendingFrom ? { cursor: "crosshair" } : {}) }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const t = e.target as Element;
            if (t.closest(".fac-node")) return;
            if ((e.target as Element).closest(".conn-handle")) {
              const fid = (e.target as Element).closest(".fac-node")?.getAttribute("data-fac-id");
              if (fid) { setPendingFrom({ id: fid, x: e.clientX, y: e.clientY }); return; }
            }
            if (t.closest(".conn-type-picker")) return;
            if (pendingFrom) { setPendingFrom(null); setCursor(null); return; }
            pan.current = { x: e.clientX, y: e.clientY, basePanX: scale.panX, basePanY: scale.panY };
          }}
          onPointerMove={onCanvasMove}
          onPointerUp={() => { moveFactionRaf.flush(); drag.current = null; pan.current = null; }}
        >
          <div
            className="absolute bg-[radial-gradient(circle_at_25%_25%,#17162a,var(--ink)_65%)] shadow-[inset_0_0_0_1px_var(--line)]"
            data-testid="fw-plane"
            style={{
              width: planeSize,
              height: planeSize,
              transform: `translate(${scale.panX}px, ${scale.panY}px) scale(${scale.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="fw-edges" className="edges-layer absolute left-0 top-0 w-full h-full pointer-events-none" width="100%" height="100%">
              <FEdgesLayer connections={web.connections} facById={facById} />
              {pendingFrom ? (() => {
                const from = facById.get(pendingFrom.id);
                if (!from || !cursor) return null;
                return <line data-testid="pending-conn" x1={from.x} y1={from.y} x2={cursor.x / scaleRef.current.s} y2={cursor.y / scaleRef.current.s} className="[stroke:var(--gold)] [stroke-width:2] [stroke-dasharray:6_6]" />;
              })() : null}
            </svg>
            <FNodesLayer factions={web.factions} selectedId={selectedId} handleNodeDown={handleNodeDown} handleNodeClick={handleNodeClick} handleConnectDown={handleConnectDown} />
          </div>
          {web.factions.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[calc(1/var(--bl-scale,0.1))] text-slate whitespace-nowrap">Add the first faction to the web.</div>
          ) : null}
          {pendingFrom ? (
            <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-night-2 border border-line text-parchment-dim px-3 py-1.5 rounded-lg text-[13px]">Choose a faction to connect.</div>
          ) : null}
        </div>
        <FactionPanel
          web={web}
          selectedId={selectedId}
          selectedConnectionId={null}
          onSelect={setSelectedId}
        />
        {notesOpen ? <WebNotepad notes={web.notes} onNotes={(v) => useScriptorium.getState().setWebNotes(webId, v)} onClose={() => setNotesOpen(false)} /> : null}
        {typePicker ? (
          <div className="conn-type-picker absolute z-45 bg-night-2 border border-line rounded-lg p-1.5 grid gap-1" style={{ left: typePicker.left, top: typePicker.top }} data-testid="conn-type-picker">
            {Object.entries(FACTION_CONNECTION_STYLES).map(([type, style]) => (
              <button
                key={type}
                type="button"
                className="bg-transparent border rounded-sm px-2.5 py-1 text-[13px] text-left hover:brightness-110"
                style={{ borderColor: style.color, color: style.color }}
                onClick={() => { setConnectionType(typePicker.connId, type as never); setTypePicker(null); }}
              >
                {style.label}
              </button>
            ))}
            <button type="button" className="conn-type-option bg-transparent border border-line rounded-sm px-2.5 py-1 text-[13px] text-left hover:brightness-110" onClick={() => { useScriptorium.getState().removeConnection(typePicker.connId); setTypePicker(null); }}>Remove connection</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
