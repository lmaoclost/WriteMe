import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { WellNotepad } from "./WellNotepad";
import type { WellSpring, WellKind } from "../../domain/types";
import "./wellspring.css";

export const WELL_KIND_META: Record<WellKind, { label: string; icon: string; color: string }> = {
  character: { label: "Character", icon: "👤", color: "#e74c3c" },
  setting: { label: "Setting", icon: "🗺", color: "#3498db" },
  conflict: { label: "Conflict", icon: "⚔", color: "#e67e22" },
  question: { label: "Question", icon: "❓", color: "#9b59b6" },
};

export function WellSpringPage({ wellId }: { wellId: string }) {
  const well = useScriptorium((s) => (s.wellsprings ?? []).find((w) => w.id === wellId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const pushWSHistory = useScriptorium((s) => s.pushWSHistory);
  const addWellNode = useScriptorium((s) => s.addWellNode);
  const moveWellNode = useScriptorium((s) => s.moveWellNode);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`ws_${wellId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ s: 1, panX: 80, panY: 40 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placingKind, setPlacingKind] = useState<WellKind | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const nodeDrag = useRef<{ id: string; sx: number; sy: number; baseX: number; baseY: number; pushed: boolean } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  useEffect(() => {
    if (!well) pushToast("error", "Wellspring not found.");
  }, [well, pushToast]);

  if (!well) return null;

  const nodeById = (id: string) => well.nodes.find((n) => n.id === id);

  return (
    <div className="well-page" data-testid="well-page">
      <header className="bl-header">
        <input
          className="bl-name"
          aria-label="Wellspring name"
          value={well.name}
          onChange={(e) => useScriptorium.getState().renameWellSpring(wellId, e.target.value)}
        />
        <div className="well-toolkit">
          {(Object.keys(WELL_KIND_META) as WellKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={placingKind === k}
              className={"well-kind-btn" + (placingKind === k ? " armed" : "") + (placingKind && placingKind !== k ? " dim" : "")}
              style={{ borderColor: WELL_KIND_META[k].color }}
              onClick={() => setPlacingKind((cur) => (cur === k ? null : k))}
            >
              {WELL_KIND_META[k].icon} {WELL_KIND_META[k].label}
            </button>
          ))}
        </div>
        <div className="bl-actions">
          <button type="button" aria-label="Undo" disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoWS(wellId)}>↶</button>
          <button type="button" aria-label="Redo" disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoWS(wellId)}>↷</button>
          <button type="button" onClick={() => setNotesOpen((v) => !v)}>Notes</button>
        </div>
      </header>
      <div className="bl-body">
        <div
          className="bl-canvas"
          data-testid="well-canvas"
          ref={stageRef}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const target = e.target as Element;
            if (target.closest(".well-node") || target.closest(".node-kind-btn")) return;
            if (placingKind) {
              const rect = stageRef.current?.getBoundingClientRect();
              if (!rect) return;
              const created = addWellNode(wellId, {
                kind: placingKind,
                x: (e.clientX - rect.left - view.panX) / view.s,
                y: (e.clientY - rect.top - view.panY) / view.s,
                text: "",
              });
              if (created) setSelectedId(created.id);
              setPlacingKind(null);
              return;
            }
            pan.current = { x: e.clientX, y: e.clientY, basePanX: view.panX, basePanY: view.panY };
          }}
          onPointerMove={(e) => {
            const d = nodeDrag.current;
            if (d) {
              const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
              if (Math.hypot(dx, dy) > 5) {
                if (!d.pushed) { pushWSHistory(wellId); d.pushed = true; }
                moveWellNode(d.id, d.baseX + dx / view.s, d.baseY + dy / view.s);
              }
              return;
            }
            const p = pan.current;
            if (p) setView((v) => ({ ...v, panX: p.basePanX + (e.clientX - p.x), panY: p.basePanY + (e.clientY - p.y) }));
          }}
          onPointerUp={() => { nodeDrag.current = null; pan.current = null; }}
          onWheel={(e) => {
            e.preventDefault();
            const rect = stageRef.current?.getBoundingClientRect();
            if (!rect) return;
            const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
            const s = Math.min(8, Math.max(0.1, view.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
            const relX = (sx - view.panX) / view.s, relY = (sy - view.panY) / view.s;
            setView({ s, panX: sx - relX * s, panY: sy - relY * s });
          }}
        >
          <div
            className="bl-plane"
            data-testid="well-plane"
            style={{
              width: 20000, height: 20000,
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="well-borders" className="edges-layer" width="100%" height="100%">
              {well.borders.map((b) => {
                const a = nodeById(b.fromId), c = nodeById(b.toId);
                if (!a || !c) return null;
                const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
                return (
                  <g key={b.id}>
                    <line data-testid="well-border" x1={a.x} y1={a.y} x2={c.x} y2={c.y} className="well-border-line" />
                    <text x={mx} y={my - 8} className="well-border-label" textAnchor="middle">{b.label}</text>
                    <line
                      x1={a.x} y1={a.y} x2={c.x} y2={c.y}
                      className="plot-wire-hit"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => useScriptorium.getState().removeWellBorder(b.id)}
                    />
                  </g>
                );
              })}
            </svg>
            {well.nodes.map((n) => {
              const meta = WELL_KIND_META[n.kind];
              return (
                <div
                  key={n.id}
                  className={"well-node" + (n.id === selectedId ? " selected" : "")}
                  data-testid="well-node"
                  data-node-id={n.id}
                  style={{ left: n.x - 80, top: n.y - 26, borderColor: meta.color, color: meta.color }}
                  role="button"
                  aria-label={`Note ${meta.label}: ${n.text || "empty"}`}
                  tabIndex={0}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    const t = e.target as Element;
                    if (t.closest(".conn-btn")) return;
                    setSelectedId(n.id);
                    nodeDrag.current = { id: n.id, sx: e.clientX, sy: e.clientY, baseX: n.x, baseY: n.y, pushed: false };
                  }}
                >
                  <span aria-hidden="true">{meta.icon}</span>
                  <span className="well-node-text">{n.text || meta.label}</span>
                  <button
                    type="button"
                    className="conn-btn"
                    aria-label={`Borda de ${n.text || meta.label}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedId(n.id);
                      useScriptorium.setState((st) => st); // no-op: border picked via panel
                      void useScriptorium.getState().addWellBorder;
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >●</button>
                </div>
              );
            })}
          </div>
          {well.nodes.length === 0 ? (
            <div className="bl-empty">
              {placingKind
                ? `Escolha onde ancorar: ${WELL_KIND_META[placingKind].label}`
                : "Choose a type and click the canvas — sketch a loose idea before it has a home."}
            </div>
          ) : null}
          <WellPanel well={well} selectedId={selectedId} onSelect={setSelectedId} otherNodes={well.nodes} />
          {notesOpen ? <WellNotepad notes={well.notes} onNotes={(v) => useScriptorium.getState().setWellNotes(wellId, v)} onClose={() => setNotesOpen(false)} /> : null}
        </div>
      </div>
    </div>
  );
}

function WellPanel({ well, selectedId, onSelect, otherNodes }: {
  well: WellSpring;
  selectedId: string | null;
  onSelect(id: string | null): void;
  otherNodes: WellSpring["nodes"];
}) {
  const store = useScriptorium.getState;
  const pushToast = useScriptorium((s) => s.pushToast);
  const node = well.nodes.find((n) => n.id === selectedId);
  const [armDelete, setArmDelete] = useState(false);
  const [fromId, setFromId] = useState("");
  const [borderLabel, setBorderLabel] = useState("");

  if (!node) {
    return (
      <aside className="bl-panel" data-testid="well-panel">
        <p className="bl-panel-hint">Pick a note on the canvas.</p>
      </aside>
    );
  }

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deleteWellNode(node.id);
    pushToast("success", "Note deleted.");
    onSelect(null);
  };

  const others = otherNodes.filter((n) => n.id !== node.id);
  const bordersMine = well.borders.filter((b) => b.fromId === node.id || b.toId === node.id);

  return (
    <aside className="bl-panel" data-testid="well-panel">
      <header className="bl-panel-head">
        <h2>{node.text || WELL_KIND_META[node.kind].label}</h2>
        <button type="button" className={armDelete ? "btn-danger" : ""} onClick={remove}
          aria-label={armDelete ? "Confirm delete note" : "Delete note"}>
          {armDelete ? "Confirmar?" : "Excluir"}
        </button>
      </header>
      <div className="field">
        <span className="field-label">Text</span>
        <input aria-label="Node text" value={node.text} onChange={(e) => store().updateWellNode(node.id, { text: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Type</span>
        <select aria-label="Node type" value={node.kind} onChange={(e) => store().updateWellNode(node.id, { kind: e.target.value as WellKind })}>
          {(Object.keys(WELL_KIND_META) as WellKind[]).map((k) => (
            <option key={k} value={k}>{WELL_KIND_META[k].label}</option>
          ))}
        </select>
      </div>
      <section className="bl-subsection">
        <h3>Fronteiras (bordas)</h3>
        {bordersMine.length === 0 ? <p className="dim">Nenhuma borda.</p> : null}
        {bordersMine.map((b) => {
          const otherId = b.fromId === node.id ? b.toId : b.fromId;
          const other = well.nodes.find((n) => n.id === otherId);
          return (
            <div key={b.id} className="oath-edit-row" data-testid="well-border-row">
              <span className="dim">{other?.text || "?"}:</span>
              <input
                aria-label={`Label da borda com ${other?.text ?? "?"}`}
                value={b.label}
                onChange={(e) => store().updateWellBorder(b.id, e.target.value)}
                onBlur={() => { if (!b.label.trim()) store().removeWellBorder(b.id); }}
              />
              <button type="button" aria-label="Remove border" onClick={() => store().removeWellBorder(b.id)}>✕</button>
            </div>
          );
        })}
        <div className="well-border-add">
          <select aria-label="Border target" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">Connect to...</option>
            {others.map((n) => <option key={n.id} value={n.id}>{n.text || WELL_KIND_META[n.kind].label}</option>)}
          </select>
          <input aria-label="Name this border" placeholder="como essa fronteira se chama?" value={borderLabel} onChange={(e) => setBorderLabel(e.target.value)} />
          <button
            type="button"
            disabled={!fromId || !borderLabel.trim()}
            onClick={() => {
              const b = store().addWellBorder(well.id, node.id, fromId, borderLabel.trim());
              if (!b) { pushToast("error", "Those two are already connected."); return; }
              setFromId("");
              setBorderLabel("");
            }}
          >+ Borda</button>
        </div>
      </section>
      <p className="bl-panel-note">{well.nodes.length} notes · {well.borders.length} borders</p>
    </aside>
  );
}
