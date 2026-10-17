import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { FACTION_CONNECTION_STYLES } from "./connectionStyles";
import { FactionPanel } from "./FactionPanel";
import { WebNotepad } from "./WebNotepad";
import type { Faction } from "../../domain/types";
import "./factions.css";

export function FactionWebPage({ webId }: { webId: string }) {
  const web = useScriptorium((s) => (s.factionWebs ?? []).find((w) => w.id === webId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const pushFWHistory = useScriptorium((s) => s.pushFWHistory);
  const addFaction = useScriptorium((s) => s.addFaction);
  const moveFaction = useScriptorium((s) => s.moveFaction);
  const addConnection = useScriptorium((s) => s.addConnection);
  const setConnectionType = useScriptorium((s) => s.setConnectionType);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`fw_${webId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState({ s: 0.1, panX: 0, panY: 0 });
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [pendingFrom, setPendingFrom] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [typePicker, setTypePicker] = useState<{ connId: string; left: number; top: number } | null>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; baseX: number; baseY: number; pushed: boolean } | null>(null);

  useEffect(() => {
    if (!web) pushToast("error", "Faction web not found.");
  }, [web, pushToast]);

  const planeSize = useMemo(() => {
    let size = 20000;
    for (const f of web?.factions ?? []) size = Math.max(size, f.x + 4000, f.y + 4000);
    return Math.ceil(size / 10000) * 10000;
  }, [web]);

  const fitToContentNow = () => {
    const el = stageRef.current;
    if (!el || !el.clientWidth || !web?.factions.length) return;
    const xs = web.factions.map((f) => f.x);
    const ys = web.factions.map((f) => f.y);
    const MIN_SPAN = 600;
    const bw = Math.max(Math.max(...xs) - Math.min(...xs), MIN_SPAN);
    const bh = Math.max(Math.max(...ys) - Math.min(...ys), MIN_SPAN);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const s = Math.min(1, Math.min(el.clientWidth / bw, el.clientHeight / bh) * 0.85);
    setScale({ s, panX: el.clientWidth / 2 - cx * s, panY: el.clientHeight / 2 - cy * s });
  };

  // center-ish default view — fit the CONTENT (factions), capped at scale 1
  useEffect(() => {
    fitToContentNow();
    // run once per web mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = stageRef.current;
    if (!el) return;
    const sx = e.clientX - el.getBoundingClientRect().left, sy = e.clientY - el.getBoundingClientRect().top;
    const prev = scaleRef.current;
    const s = Math.min(8, Math.max(0.02, prev.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    const relX = (sx - prev.panX) / prev.s, relY = (sy - prev.panY) / prev.s;
    const next = { s, panX: sx - relX * s, panY: sy - relY * s };
    setScale(next);
  };

  if (!web) return null;

  const factionNodeById = (id: string) => web.factions.find((f) => f.id === id);
  const centerOf = (f: Faction) => ({ x: f.x, y: f.y });

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
        moveFaction(d.id, d.baseX + dx / scaleRef.current.s, d.baseY + dy / scaleRef.current.s);
      }
      return;
    }
    // pan
    if (pan.current) {
      setScale((v) => ({ ...v, panX: pan.current!.basePanX + (e.clientX - pan.current!.x), panY: pan.current!.basePanY + (e.clientY - pan.current!.y) }));
    }
  };
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  const onNodeClick = (f: Faction) => {
    if (pendingFrom && pendingFrom.id !== f.id) {
      const conn = addConnection(webId, pendingFrom.id, f.id);
      setPendingFrom(null);
      setCursor(null);
      if (conn) {
        const from = factionNodeById(conn.fromId);
        const to = factionNodeById(conn.toId);
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

  void centerOf;

  return (
    <div className="factions-page" data-testid="factions-page">
      <header className="bl-header">
        <input
          className="bl-name"
          aria-label="Faction web name"
          value={web.name}
          onChange={(e) => useScriptorium.getState().renameFactionWeb(webId, e.target.value)}
        />
        <div className="bl-actions">
          <button type="button" aria-label="Undo" disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoFW(webId)}>↶</button>
          <button type="button" aria-label="Redo" disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoFW(webId)}>↷</button>
          <button type="button" aria-label="Zoom out" onClick={() => setScale((v) => zoomAt({ ...v }, 1 / 1.25, elWidth(), elHeight()))}>−</button>
          <span className="fw-zoom" data-testid="fw-zoom">{Math.round(scale.s * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setScale((v) => zoomAt({ ...v }, 1.25, elWidth(), elHeight()))}>+</button>
          <button type="button" onClick={() => adjustView()}>Ajustar</button>
          <button type="button" onClick={() => { pushFWHistory(webId); const el = stageRef.current; const f = addFaction(webId, { x: el ? (el.clientWidth / 2 - scaleRef.current.panX) / scaleRef.current.s : 4000, y: el ? (el.clientHeight / 2 - scaleRef.current.panY) / scaleRef.current.s : 4000 }); if (f) setSelectedId(f.id); }}>
            New Faction
          </button>
          <button type="button" onClick={() => setNotesOpen((v) => !v)}>Notes</button>
        </div>
      </header>
      <div className="bl-body">
        <div
          className="bl-canvas"
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
          onPointerUp={() => { drag.current = null; pan.current = null; }}
          onWheel={onWheelZoom}
        >
          <div
            className="bl-plane"
            data-testid="fw-plane"
            style={{
              width: planeSize,
              height: planeSize,
              transform: `translate(${scale.panX}px, ${scale.panY}px) scale(${scale.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="fw-edges" className="edges-layer" width="100%" height="100%">
              {web.connections.map((c) => {
                const a = factionNodeById(c.fromId);
                const b = factionNodeById(c.toId);
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
                    <text x={mx} y={my - 6} className="edge-type-label" fill={style.color} textAnchor="middle">{style.label}</text>
                  </g>
                );
              })}
              {pendingFrom ? (() => {
                const from = factionNodeById(pendingFrom.id);
                if (!from || !cursor) return null;
                return <line data-testid="pending-conn" x1={from.x} y1={from.y} x2={cursor.x / scaleRef.current.s} y2={cursor.y / scaleRef.current.s} className="pending-conn" />;
              })() : null}
            </svg>
            {web.factions.map((f) => (
              <div
                key={f.id}
                className={`fac-node${selectedId === f.id ? " selected" : ""}`}
                data-fac-id={f.id}
                data-testid="fac-node"
                style={{ left: f.x - 60, top: f.y - 22, borderTopColor: f.color }}
                onPointerDown={(e) => {
                  const d = e.target as Element;
                  if (d.closest(".conn-handle")) { (e.target as HTMLElement).dataset.startConn = "1"; return; }
                  if (pendingFrom) { onNodeClick(f); return; }
                  setSelectedId(f.id);
                  drag.current = { id: f.id, startX: e.clientX, startY: e.clientY, baseX: f.x, baseY: f.y, pushed: false };
                }}
                onClick={() => {
                  if (pendingFrom) onNodeClick(f);
                }}
                role="button"
                aria-label={`Faction ${f.name}`}
                tabIndex={0}
              >
                <span className="fac-dot" style={{ background: f.color }} />
                <span className="fac-name">{f.name}</span>
                {f.leader ? <span className="fac-leader">{f.leader}</span> : null}
                <button
                  type="button"
                  className="conn-handle"
                  aria-label={`Conectar ${f.name}`}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (!pendingFrom) {
                      setPendingFrom({ id: f.id, x: e.clientX, y: e.clientY });
                    } else {
                      onNodeClick(f);
                    }
                  }}
                >
                  ●
                </button>
              </div>
            ))}
          </div>
          {web.factions.length === 0 ? (
            <div className="bl-empty">Add the first faction to the web.</div>
          ) : null}
          {pendingFrom ? (
            <div className="fac-hint">Choose a faction to connect.</div>
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
          <div className="conn-type-picker" style={{ left: typePicker.left, top: typePicker.top }} data-testid="conn-type-picker">
            {Object.entries(FACTION_CONNECTION_STYLES).map(([type, style]) => (
              <button
                key={type}
                type="button"
                className="conn-type-option"
                style={{ borderColor: style.color, color: style.color }}
                onClick={() => { setConnectionType(typePicker.connId, type as never); setTypePicker(null); }}
              >
                {style.label}
              </button>
            ))}
            <button type="button" className="conn-type-option" onClick={() => { useScriptorium.getState().removeConnection(typePicker.connId); setTypePicker(null); }}>Remove connection</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
