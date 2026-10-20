import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2 } from "../../ui/board";
import { useScriptorium } from "../../data/store";
import { WellNotepad } from "./WellNotepad";
import type { WellSpring, WellKind } from "../../domain/types";
import { useBoardNotesHotkey } from "../../ui/boardNotes";
import { useRafState, useRafCallback } from "../../ui/useRaf";


export const WELL_KIND_META = {
  character: { labelKey: "wellspring.kind.character", icon: "👤", color: "#e74c3c" },
  setting: { labelKey: "wellspring.kind.setting", icon: "🗺", color: "#3498db" },
  conflict: { labelKey: "wellspring.kind.conflict", icon: "⚔", color: "#e67e22" },
  question: { labelKey: "wellspring.kind.question", icon: "❓", color: "#9b59b6" },
} as const satisfies Record<WellKind, { labelKey: string; icon: string; color: string }>;

export function WellSpringPage({ wellId }: { wellId: string }) {
  const { t } = useTranslation();
  const well = useScriptorium((s) => (s.wellsprings ?? []).find((w) => w.id === wellId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const pushWSHistory = useScriptorium((s) => s.pushWSHistory);
  const addWellNode = useScriptorium((s) => s.addWellNode);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`ws_${wellId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  const stageRef = useRef<HTMLDivElement>(null);
  const [view, scheduleView] = useRafState({ s: 1, panX: 80, panY: 40 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placingKind, setPlacingKind] = useState<WellKind | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const nodeDrag = useRef<{ id: string; sx: number; sy: number; baseX: number; baseY: number; pushed: boolean } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Coalesced drag: one moveWellNode per frame; pointerup flushes.
  const moveNodeRaf = useRafCallback((id: string, x: number, y: number) => {
    useScriptorium.getState().moveWellNode(id, x, y);
  });

  // Wheel zoom on a native non-passive listener; chained functional updates
  // keep rapid wheel bursts exact (the old closure read a stale view.s).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      scheduleView((v) => {
        const s = Math.min(8, Math.max(0.1, v.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        const relX = (sx - v.panX) / v.s, relY = (sy - v.panY) / v.s;
        return { s, panX: sx - relX * s, panY: sy - relY * s };
      });
      scheduleView.flush();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [scheduleView]);

  useEffect(() => {
    if (!well) pushToast("error", t("wellspring.page.notFound"));
  }, [well, pushToast, t]);

  if (!well) return null;

  const nodeByIdMap = new Map(well.nodes.map((n) => [n.id, n] as const));
  const nodeById = (id: string) => nodeByIdMap.get(id);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="well-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label={t("wellspring.page.name")}
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
              {WELL_KIND_META[k].icon} {t(WELL_KIND_META[k].labelKey)}
            </button>
          ))}
        </div>
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label={t("wellspring.page.undo")} className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoWS(wellId)}>↶</button>
          <button type="button" aria-label={t("wellspring.page.redo")} className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoWS(wellId)}>↷</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>{t("wellspring.page.notes")}</button>
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
              const v = viewRef.current;
              const created = addWellNode(wellId, {
                kind: placingKind,
                x: (e.clientX - rect.left - v.panX) / v.s,
                y: (e.clientY - rect.top - v.panY) / v.s,
                text: "",
              });
              if (created) setSelectedId(created.id);
              setPlacingKind(null);
              return;
            }
            pan.current = { x: e.clientX, y: e.clientY, basePanX: viewRef.current.panX, basePanY: viewRef.current.panY };
          }}
          onPointerMove={(e) => {
            const d = nodeDrag.current;
            if (d) {
              const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
              if (Math.hypot(dx, dy) > 5) {
                if (!d.pushed) { pushWSHistory(wellId); d.pushed = true; }
                moveNodeRaf(d.id, d.baseX + dx / viewRef.current.s, d.baseY + dy / viewRef.current.s);
              }
              return;
            }
            const p = pan.current;
            if (p) {
              const panX = p.basePanX + (e.clientX - p.x);
              const panY = p.basePanY + (e.clientY - p.y);
              scheduleView((v) => (v.panX === panX && v.panY === panY ? v : { ...v, panX, panY }));
            }
          }}
          onPointerUp={() => { moveNodeRaf.flush(); scheduleView.flush(); nodeDrag.current = null; pan.current = null; }}
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
                  aria-label={t("wellspring.page.noteAria", { kind: t(meta.labelKey), text: n.text || t("wellspring.page.emptyText") })}
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
                  <span className="text-[13px] font-semibold text-parchment">{n.text || t(meta.labelKey)}</span>
                  <button
                    type="button"
                    className="conn-btn w-5 h-5 rounded-full bg-gold text-wax border-0 text-[0.6875rem] grid place-items-center cursor-crosshair"
                    aria-label={t("wellspring.page.borderAria", { name: n.text || t(meta.labelKey) })}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedId(n.id);
                      // border picking happens in the panel (self-borders rejected)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >●</button>
                </div>
              );
            })}
          </div>
          {well.nodes.length === 0 ? (
            <div className="board-empty-hint absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate">
              {placingKind
                ? t("wellspring.page.placeHint", { kind: t(WELL_KIND_META[placingKind].labelKey) })
                : t("wellspring.page.emptyHint")}
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
  const { t } = useTranslation();
  const store = useScriptorium.getState;
  const pushToast = useScriptorium((s) => s.pushToast);
  const node = well.nodes.find((n) => n.id === selectedId);
  const [armDelete, setArmDelete] = useState(false);
  const [fromId, setFromId] = useState("");
  const [borderLabel, setBorderLabel] = useState("");

  if (!node) {
    return (
      <aside className={BOARD_PANEL} data-testid="well-panel">
        <p className={BOARD_PANEL_HINT}>{t("wellspring.panel.selectHint")}</p>
      </aside>
    );
  }

  const remove = () => {
    if (!armDelete) { setArmDelete(true); return; }
    store().deleteWellNode(node.id);
    pushToast("success", t("wellspring.panel.noteDeleted"));
    onSelect(null);
  };

  const others = otherNodes.filter((n) => n.id !== node.id);
  const bordersMine = well.borders.filter((b) => b.fromId === node.id || b.toId === node.id);

  return (
    <aside className={BOARD_PANEL} data-testid="well-panel">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{node.text || t(WELL_KIND_META[node.kind].labelKey)}</h2>
        <Button kind={armDelete ? "danger" : "ghost"} className="px-2 py-1 text-xs" onClick={remove}
          aria-label={armDelete ? t("wellspring.panel.confirmDelete") : t("wellspring.panel.deleteNote")}>
          {armDelete ? t("common.confirm") : t("common.delete")}
        </Button>
      </header>
      <Field label={t("wellspring.panel.text")}>
        <input aria-label={t("wellspring.panel.textAria")} value={node.text} onChange={(e) => store().updateWellNode(node.id, { text: e.target.value })} />
      </Field>
      <Field label={t("wellspring.panel.type")}>
        <Select value={node.kind} onValueChange={(v) => store().updateWellNode(node.id, { kind: v as WellKind })}>
          <SelectTrigger aria-label={t("wellspring.panel.typeAria")} className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            {(Object.keys(WELL_KIND_META) as WellKind[]).map((k) => (
              <SelectItem key={k} value={k} className="text-xs focus:bg-[#24233f] focus:text-parchment">{t(WELL_KIND_META[k].labelKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <section className="border-t border-line mt-3.5 pt-2.5 grid gap-2">
        <h3 className="text-[13px] tracking-[0.08em] uppercase text-slate font-semibold">{t("wellspring.panel.borders")}</h3>
        {bordersMine.length === 0 ? <p className="text-slate">{t("wellspring.panel.none")}</p> : null}
        {bordersMine.map((b) => {
          const otherId = b.fromId === node.id ? b.toId : b.fromId;
          const other = well.nodes.find((n) => n.id === otherId);
          return (
            <div key={b.id} className="flex flex-wrap items-center gap-1.5" data-testid="well-border-row">
              <span className="text-slate">{other?.text || "?"}:</span>
              <input
                aria-label={t("wellspring.panel.borderLabelAria", { name: other?.text ?? "?" })}
                value={b.label}
                onChange={(e) => store().updateWellBorder(b.id, e.target.value)}
                onBlur={() => { if (!b.label.trim()) store().removeWellBorder(b.id); }}
                className="min-w-0 flex-1 bg-ink border border-line rounded-sm text-parchment px-1.5 py-0.5 text-xs"
              />
              <button type="button" aria-label={t("wellspring.panel.removeBorder")} onClick={() => store().removeWellBorder(b.id)} className="bg-none border-0 text-slate text-xs">✕</button>
            </div>
          );
        })}
        <div className="grid gap-1.5">
          <Select value={fromId} onValueChange={(v) => setFromId(v)}>
            <SelectTrigger aria-label={t("wellspring.panel.target")} className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue placeholder={t("wellspring.panel.connectTo")} /></SelectTrigger>
            <SelectContent className="border-line bg-night text-parchment">
              {others.map((n) => <SelectItem key={n.id} value={n.id} className="text-xs focus:bg-[#24233f] focus:text-parchment">{n.text || t(WELL_KIND_META[n.kind].labelKey)}</SelectItem>)}
            </SelectContent>
          </Select>
          <input aria-label={t("wellspring.panel.nameBorder")} placeholder={t("wellspring.panel.nameBorderPlaceholder")} value={borderLabel} onChange={(e) => setBorderLabel(e.target.value)} className="bg-ink border border-line rounded-sm text-parchment px-2 py-1.5 text-xs" />
          <Button
            disabled={!fromId || !borderLabel.trim()}
            onClick={() => {
              const b = store().addWellBorder(well.id, node.id, fromId, borderLabel.trim());
              if (!b) { pushToast("error", t("wellspring.panel.alreadyConnected")); return; }
              setFromId("");
              setBorderLabel("");
            }}
          >{t("wellspring.panel.addBorder")}</Button>
        </div>
      </section>
      <p className="text-slate text-xs">
        {t("wellspring.panel.counts", {
          notes: t("wellspring.panel.noteCount", { count: well.nodes.length }),
          borders: t("wellspring.panel.borderCount", { count: well.borders.length }),
        })}
      </p>
    </aside>
  );
}
