import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { PlotBoardPanel } from "./PlotBoardPanel";
import { BoardNotepad } from "./BoardNotepad";
import "./plotboard.css";

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
  const cardDrag = useRef<{ id: string; sx: number; sy: number; baseX: number; baseY: number; pushed: boolean } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);

  useEffect(() => {
    if (!board) pushToast("error", "Plano não encontrado.");
  }, [board, pushToast]);

  if (!board) return null;

  const byId = (id: string) => board.cards.find((c) => c.id === id);

  return (
    <div className="plotboard-page" data-testid="plotboard-page">
      <header className="bl-header">
        <input
          className="bl-name"
          aria-label="Nome do plano"
          value={board.name}
          onChange={(e) => useScriptorium.getState().renamePlotBoard(boardId, e.target.value)}
        />
        <div className="bl-actions">
          <button type="button" aria-label="Desfazer" disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoPB(boardId)}>↶</button>
          <button type="button" aria-label="Refazer" disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoPB(boardId)}>↷</button>
          {!board.hasPrologue ? (
            <button type="button" onClick={() => { pushPBHistory(boardId); useScriptorium.getState().setBoardFlags(boardId, { hasPrologue: true }); }}>+ Prólogo</button>
          ) : null}
          {!board.hasEpilogue ? (
            <button type="button" onClick={() => { pushPBHistory(boardId); useScriptorium.getState().setBoardFlags(boardId, { hasEpilogue: true }); }}>+ Epílogo</button>
          ) : null}
          <button type="button" onClick={() => setNotesOpen((v) => !v)}>Notas</button>
        </div>
      </header>
      <div className="bl-body">
        <div
          className="bl-canvas"
          data-testid="pb-canvas"
          ref={stageRef}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const target = e.target as Element;
            if (target.closest(".board-card") || target.closest(".wire-delete")) return;
            if (connecting) { setConnecting(null); setGhost(null); return; }
            // click the board → place a new card there
            const rect = stageRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = (e.clientX - rect.left - view.panX) / view.s;
            const y = (e.clientY - rect.top - view.panY) / view.s;
            const created = useScriptorium.getState().addCard(boardId, { x, y, actId: board.acts[0]?.id });
            if (created) setSelectedCardId(created.id);
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
            className="bl-plane"
            data-testid="pb-plane"
            style={{
              width: 20000, height: 20000,
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.s})`,
              transformOrigin: "0 0",
            }}
          >
            <svg data-testid="pb-wires" className="edges-layer" width="100%" height="100%">
              {board.wires.map((w) => {
                const a = byId(w.fromCardId), b = byId(w.toCardId);
                if (!a || !b) return null;
                return (
                  <g key={w.id}>
                    <line data-testid="board-wire" x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="plot-wire" />
                    <line
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      className="plot-wire-hit"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => useScriptorium.getState().removeWire(w.id)}
                    />
                  </g>
                );
              })}
              {connecting ? (() => {
                const a = byId(connecting);
                if (!a || !ghost) return null;
                return <line data-testid="pending-conn" className="pending-conn" x1={a.x} y1={a.y} x2={ghost.x / view.s} y2={ghost.y / view.s} />;
              })() : null}
            </svg>
            {board.cards.map((c) => (
              <div
                key={c.id}
                className={"board-card" + (c.id === selectedCardId ? " selected" : "")}
                data-testid="board-card"
                data-card-id={c.id}
                style={{ left: c.x - 80, top: c.y - 20, borderTopColor: c.color }}
                role="button"
                aria-label={`Cena ${c.title || "sem título"}`}
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
                <span className="fac-dot" style={{ background: c.color }} />
                <span className="board-card-title">{c.title || "Cena sem título"}</span>
                {c.pov ? <span className="fac-leader">POV: {c.pov}</span> : null}
                {c.location ? <span className="fac-leader">{c.location}</span> : null}
                <button
                  type="button"
                  className="conn-btn"
                  aria-label={`Conectar cena ${c.title || ""}`}
                  onPointerDown={(e) => { e.stopPropagation(); setConnecting(c.id); setGhost(null); }}
                  onClick={(e) => e.stopPropagation()}
                >●</button>
              </div>
            ))}
          </div>
          {board.cards.length === 0 ? (
            <div className="bl-empty">Escreva a primeira cena — clique no quadro para colocá-la.</div>
          ) : connecting ? (
            <div className="fac-hint">Escolha a cena destino para aramar o fio.</div>
          ) : null}
          <PlotBoardPanel board={board} selectedId={selectedCardId} onSelect={setSelectedCardId} />
          {notesOpen ? <BoardNotepad notes={board.notes} onNotes={(v) => useScriptorium.getState().setBoardNotes(boardId, v)} onClose={() => setNotesOpen(false)} /> : null}
        </div>
      </div>
    </div>
  );
}
