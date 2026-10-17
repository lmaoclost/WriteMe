import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { PlotBoardPanel } from "./PlotBoardPanel";
import { BoardNotepad } from "./BoardNotepad";
import { useBoardNotesHotkey } from "../../ui/boardNotes";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS } from "../../ui/board";


export function PlotBoardPage({ boardId }: { boardId: string }) {
  const board = useScriptorium((s) => (s.plotBoards ?? []).find((b) => b.id === boardId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const pushPBHistory = useScriptorium((s) => s.pushPBHistory);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`pb_${boardId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ s: 0.5, panX: 60, panY: 20 });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const cardDrag = useRef<{ id: string; sx: number; sy: number; baseX: number; baseY: number; pushed: boolean } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  useEffect(() => {
    if (!board) pushToast("error", "Plot board not found.");
  }, [board, pushToast]);

  if (!board) return null;

  const byId = (id: string) => board.cards.find((c) => c.id === id);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="plotboard-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label="Plot board name"
          value={board.name}
          onChange={(e) => useScriptorium.getState().renamePlotBoard(boardId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label="Undo" disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoPB(boardId)}>↶</button>
          <button type="button" aria-label="Redo" disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoPB(boardId)}>↷</button>
          {!board.hasPrologue ? (
            <button type="button" onClick={() => { pushPBHistory(boardId); useScriptorium.getState().setBoardFlags(boardId, { hasPrologue: true }); }}>Prologue</button>
          ) : null}
          {!board.hasEpilogue ? (
            <button type="button" onClick={() => { pushPBHistory(boardId); useScriptorium.getState().setBoardFlags(boardId, { hasEpilogue: true }); }}>Epilogue</button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              pushPBHistory(boardId);
              const el = stageRef.current;
              if (!el || !el.clientWidth) return;
              const x = (el.clientWidth / 2 - view.panX) / view.s;
              const y = (el.clientHeight / 2 - view.panY) / view.s;
              const created = useScriptorium.getState().addCard(boardId, { x, y, actId: board.acts[0]?.id });
              if (created) setSelectedCardId(created.id);
            }}
          >
            + Add scene
          </button>
          <button type="button" aria-pressed={notesOpen} onClick={() => setNotesOpen((v) => !v)}>Notes ✎</button>
        </div>
      </header>
      <div className="grid grid-cols-[1fr_300px] min-h-0 overflow-hidden">
        <div
          className="relative overflow-hidden bg-ink cursor-grab active:cursor-grabbing"
          data-testid="pb-canvas"
          ref={stageRef}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const target = e.target as Element;
            if (target.closest(".board-card") || target.closest(".wire-delete")) return;
            if (connecting) { setConnecting(null); setGhost(null); return; }
            // empty canvas → pan (creation is the header button's job)
            pan.current = { x: e.clientX, y: e.clientY, basePanX: view.panX, basePanY: view.panY };
          }}
          onPointerMove={(e: React.PointerEvent) => {
            if (connecting) {
              const rect = stageRef.current?.getBoundingClientRect();
              if (rect) setGhost({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              return;
            }
            const d = cardDrag.current;
            if (d) {
              const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
              if (Math.hypot(dx, dy) > 5) {
                if (!d.pushed) { pushPBHistory(boardId); d.pushed = true; }
                useScriptorium.getState().moveCard(d.id, d.baseX + dx / view.s, d.baseY + dy / view.s);
              }
              return;
            }
            const p = pan.current;
            if (p) setView((v) => ({ ...v, panX: p.basePanX + (e.clientX - p.x), panY: p.basePanY + (e.clientY - p.y) }));
          }}
          onPointerUp={() => { cardDrag.current = null; pan.current = null; }}
          onWheel={(e: React.WheelEvent) => {
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
            data-testid="pb-plane"
            style={{
              width: 20000, height: 20000,
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="pb-wires" className="edges-layer absolute left-0 top-0 w-full h-full pointer-events-none" width="100%" height="100%">
              {board.wires.map((w) => {
                const a = byId(w.fromCardId), b = byId(w.toCardId);
                if (!a || !b) return null;
                return (
                  <g key={w.id}>
                    <line data-testid="board-wire" x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="[stroke:var(--gold-dim)] [stroke-width:2]" />
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      className="plot-wire-hit [stroke:transparent] [stroke-width:12] cursor-pointer hover:[stroke:rgb(244_67_54/0.35)]"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => useScriptorium.getState().removeWire(w.id)}
                    />
                  </g>
                );
              })}
              {connecting ? (() => {
                const a = byId(connecting);
                if (!a || !ghost) return null;
                return <line data-testid="pending-conn" className="[stroke:var(--gold)] [stroke-width:2] [stroke-dasharray:6_6]" x1={a.x} y1={a.y} x2={ghost.x / view.s} y2={ghost.y / view.s} />;
              })() : null}
            </svg>
            {board.cards.map((c) => (
              <div
                key={c.id}
                className={"board-card absolute w-40 px-2.5 py-2 rounded-lg bg-night border border-slate border-t-3 grid gap-0.5 cursor-pointer min-h-11" + (c.id === selectedCardId ? " outline outline-2 outline-gold" : "")}
                data-testid="board-card"
                data-card-id={c.id}
                style={{ left: c.x - 80, top: c.y - 20, borderTopColor: c.color }}
                role="button"
                aria-label={`Scene ${c.title || "untitled"}`}
                tabIndex={0}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  const t = e.target as Element;
                  if (t.closest(".conn-btn")) return;
                  if (connecting && connecting !== c.id) {
                    useScriptorium.getState().addWire(boardId, connecting, c.id);
                    setConnecting(null);
                    setGhost(null);
                    return;
                  }
                  setSelectedCardId(c.id);
                  cardDrag.current = { id: c.id, sx: e.clientX, sy: e.clientY, baseX: c.x, baseY: c.y, pushed: false };
                }}
                onMouseEnter={() => void 0}
              >
                <span className="absolute size-2.5 rounded-full -left-1.5 -top-1.5" style={{ background: c.color }} />
                <span className="text-[13px] font-semibold text-parchment">{c.title || "Untitled Scene"}</span>
                {c.pov ? <span className="text-[11px] text-slate">POV: {c.pov}</span> : null}
                {c.location ? <span className="text-[11px] text-slate">{c.location}</span> : null}
                <button
                  type="button"
                  className="conn-btn w-5 h-5 rounded-full bg-gold text-wax border-0 text-[0.6875rem] grid place-items-center cursor-crosshair"
                  aria-label={`Connect scene ${c.title || ""}`}
                  onPointerDown={(e) => { e.stopPropagation(); setConnecting(c.id); setGhost(null); }}
                  onClick={(e) => e.stopPropagation()}
                >●</button>
              </div>
            ))}
          </div>
          {board.cards.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[calc(1/var(--bl-scale,0.1))] text-slate whitespace-nowrap">Drag to pan the board — "+ Add scene" places a scene at the center.</div>
          ) : connecting ? (
            <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-night-2 border border-line text-parchment-dim px-3 py-1.5 rounded-lg text-[13px]">Choose a scene card to connect.</div>
          ) : null}
          {notesOpen ? <BoardNotepad notes={board.notes} onNotes={(v) => useScriptorium.getState().setBoardNotes(boardId, v)} onClose={() => setNotesOpen(false)} /> : null}
        </div>
        <PlotBoardPanel board={board} selectedId={selectedCardId} onSelect={setSelectedCardId} />
      </div>
    </div>
  );
}
