import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";
import { useScriptorium } from "../../data/store";
import { WellNotepad } from "./WellNotepad";
import type { WellSpring, WellKind } from "../../domain/types";
import { useBoardNotesHotkey } from "../../ui/boardNotes";


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
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const nodeDrag = useRef<{ id: string; sx: number; sy: number; baseX: number; baseY: number; pushed: boolean } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  useEffect(() => {
    if (!well) pushToast("error", "Wellspring not found.");
  }, [well, pushToast]);

  if (!well) return null;

  const nodeById = (id: string) => well.nodes.find((n) => n.id === id);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="well-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label="Wellspring name"
          value={well.name}
          onChange={(e) => useScriptorium.getState().renameWellSpring(wellId, e.target.value)}
        />
        <div className="flex gap-1.5">
          {(Object.keys(WELL_KIND_META) as WellKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={placingKind === k}
              className={"well-kind-btn bg-ink rounded-sm px-2.5 py-1.5 text-parchment-dim" + (placingKind === k ? " bg-[color-mix(in_srgb,var(--gold)_18%,var(--ink))] text-parchment" : "") + (placingKind && placingKind !== k ? " opacity-55" : "")}
              style={{ borderColor: WELL_KIND_META[k].color }}
              onClick={() => setPlacingKind((cur) => (cur === k ? null : k))}
            >
              {WELL_KIND_META[k].icon} {WELL_KIND_META[k].label}
            </button>
          ))}
        </div>
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label="Undo" className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoWS(wellId)}>↶</button>
          <button type="button" aria-label="Redo" className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoWS(wellId)}>↷</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>Notes ✎</button>
        </div>
      </header>
      <div className="grid grid-cols-[1fr_320px] min-h-0 overflow-hidden">
        <div
          className="relative overflow-hidden bg-ink cursor-grab active:cursor-grabbing"
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
            className="absolute bg-[radial-gradient(circle_at_25%_25%,#17162a,var(--ink)_65%)] shadow-[inset_0_0_0_1px_var(--line)]"
            data-testid="well-plane"
            style={{
              width: 20000, height: 20000,
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="well-borders" className="edges-layer absolute left-0 top-0 w-full h-full pointer-events-none" width="100%" height="100%">
              {well.borders.map((b) => {
                const a = nodeById(b.fromId), c = nodeById(b.toId);
                if (!a || !c) return null;
                const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
                return (
                  <g key={b.id}>
                    <line data-testid="well-border" x1={a.x} y1={a.y} x2={c.x} y2={c.y} className="well-border-line [stroke:var(--gold-dim)] [stroke-width:2] [stroke-dasharray:2_6]" />
                    <text x={mx} y={my - 8} className="well-border-label text-[0.6875rem] fill-slate italic" textAnchor="middle">{b.label}</text>
                    <line
                      x1={a.x} y1={a.y} x2={c.x} y2={c.y}
                      className="plot-wire-hit [stroke:transparent] [stroke-width:12] cursor-pointer hover:[stroke:rgb(244_67_54/0.35)]"
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
                  className={"well-node absolute w-40 px-3 py-2 rounded-lg bg-night border border-slate grid gap-0.5 cursor-pointer shadow-[inset_2px_0_0_currentColor]" + (n.id === selectedId ? " outline outline-2 outline-gold" : "")}
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
                  <span className="text-[13px] font-semibold text-parchment">{n.text || meta.label}</span>
                  <button
                    type="button"
                    className="conn-btn w-5 h-5 rounded-full bg-gold text-wax border-0 text-[0.6875rem] grid place-items-center cursor-crosshair"
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
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[calc(1/var(--bl-scale,0.1))] text-slate whitespace-nowrap">
              {placingKind
                ? `Escolha onde ancorar: ${WELL_KIND_META[placingKind].label}`
                : "Choose a type and click the canvas — sketch a loose idea before it has a home."}
            </div>
          ) : null}
          {notesOpen ? <WellNotepad notes={well.notes} onNotes={(v) => useScriptorium.getState().setWellNotes(wellId, v)} onClose={() => setNotesOpen(false)} /> : null}
        </div>
        <WellPanel well={well} selectedId={selectedId} onSelect={setSelectedId} otherNodes={well.nodes} />
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
      <aside className={BOARD_PANEL} data-testid="well-panel">
        <p className={BOARD_PANEL_HINT}>Pick a note on the canvas.</p>
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
    <aside className={BOARD_PANEL} data-testid="well-panel">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{node.text || WELL_KIND_META[node.kind].label}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={remove}
          aria-label={armDelete ? "Confirm delete note" : "Delete note"}>
          {armDelete ? "Confirmar?" : "Excluir"}
        </Button>
      </header>
      <Field label="Text">
        <input aria-label="Node text" value={node.text} onChange={(e) => store().updateWellNode(node.id, { text: e.target.value })} />
      </Field>
      <Field label="Type">
        <Select value={node.kind} onValueChange={(v) => store().updateWellNode(node.id, { kind: v as WellKind })}>
          <SelectTrigger aria-label="Node type" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            {(Object.keys(WELL_KIND_META) as WellKind[]).map((k) => (
              <SelectItem key={k} value={k} className="text-xs focus:bg-[#24233f] focus:text-parchment">{WELL_KIND_META[k].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3 className="text-[13px] tracking-[0.08em] uppercase text-slate font-semibold">Fronteiras (bordas)</h3>
        {bordersMine.length === 0 ? <p className="text-slate">Nenhuma borda.</p> : null}
        {bordersMine.map((b) => {
          const otherId = b.fromId === node.id ? b.toId : b.fromId;
          const other = well.nodes.find((n) => n.id === otherId);
          return (
            <div key={b.id} className="flex flex-wrap items-center gap-1.5" data-testid="well-border-row">
              <span className="text-slate">{other?.text || "?"}:</span>
              <input
                aria-label={`Label da borda com ${other?.text ?? "?"}`}
                value={b.label}
                onChange={(e) => store().updateWellBorder(b.id, e.target.value)}
                onBlur={() => { if (!b.label.trim()) store().removeWellBorder(b.id); }}
                className="min-w-0 flex-1 bg-ink border border-line rounded-sm text-parchment px-1.5 py-0.5 text-xs"
              />
              <button type="button" aria-label="Remove border" onClick={() => store().removeWellBorder(b.id)} className="bg-none border-0 text-slate text-xs">✕</button>
            </div>
          );
        })}
        <div className="grid gap-1.5">
          <Select value={fromId} onValueChange={(v) => setFromId(v)}>
            <SelectTrigger aria-label="Border target" className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue placeholder="Connect to..." /></SelectTrigger>
            <SelectContent className="border-line bg-night text-parchment">
              {others.map((n) => <SelectItem key={n.id} value={n.id} className="text-xs focus:bg-[#24233f] focus:text-parchment">{n.text || WELL_KIND_META[n.kind].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <input aria-label="Name this border" placeholder="como essa fronteira se chama?" value={borderLabel} onChange={(e) => setBorderLabel(e.target.value)} className="bg-ink border border-line rounded-sm text-parchment px-2 py-1.5 text-xs" />
          <Button
            disabled={!fromId || !borderLabel.trim()}
            onClick={() => {
              const b = store().addWellBorder(well.id, node.id, fromId, borderLabel.trim());
              if (!b) { pushToast("error", "Those two are already connected."); return; }
              setFromId("");
              setBorderLabel("");
            }}
          >+ Borda</Button>
        </div>
      </section>
      <p className="text-slate text-xs">{well.nodes.length} notes · {well.borders.length} borders</p>
    </aside>
  );
}
