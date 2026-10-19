import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import type { PlotCard, PlotWire } from "../../domain/types";
import { PlotBoardPanel } from "./PlotBoardPanel";
import { BoardNotepad } from "./BoardNotepad";
import { useBoardNotesHotkey } from "../../ui/boardNotes";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS } from "../../ui/board";
import { useRafState, useRafCallback } from "../../ui/useRaf";

const PBWiresLayer = memo(function PBWiresLayer({ wires, cardById }: {
  wires: PlotWire[];
  cardById: Map<string, { x: number; y: number }>;
}) {
  return (
    <>
      {wires.map((w) => {
        const a = cardById.get(w.fromCardId);
        const b = cardById.get(w.toCardId);
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
    </>
  );
});

const PBCardsLayer = memo(function PBCardsLayer({ cards, selectedCardId, handleCardDown, handleConnect }: {
  cards: PlotCard[];
  selectedCardId: string | null;
  handleCardDown(c: PlotCard, e: React.PointerEvent): void;
  handleConnect(c: PlotCard): void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {cards.map((c) => (
        <div
          key={c.id}
          className={"board-card absolute w-40 px-2.5 py-2 rounded-lg bg-night border border-slate border-t-3 grid gap-0.5 cursor-pointer min-h-11" + (c.id === selectedCardId ? " outline outline-2 outline-gold" : "")}
          data-testid="board-card"
          data-card-id={c.id}
          style={{ left: c.x - 80, top: c.y - 20, borderTopColor: c.color }}
          role="button"
          aria-label={t("plotboard.page.scene", { title: c.title || t("plotboard.page.untitledScene") })}
          tabIndex={0}
          onPointerDown={(e) => handleCardDown(c, e)}
        >
          <span className="absolute size-2.5 rounded-full -left-1.5 -top-1.5" style={{ background: c.color }} />
          <span className="text-[13px] font-semibold text-parchment">{c.title || t("plotboard.page.untitledScene")}</span>
          {c.pov ? <span className="text-[11px] text-slate">{t("plotboard.page.pov", { pov: c.pov })}</span> : null}
          {c.location ? <span className="text-[11px] text-slate">{c.location}</span> : null}
          <button
            type="button"
            className="conn-btn w-5 h-5 rounded-full bg-gold text-wax border-0 text-[0.6875rem] grid place-items-center cursor-crosshair"
            aria-label={t("plotboard.page.connectScene", { title: c.title || "" })}
            onPointerDown={(e) => { e.stopPropagation(); handleConnect(c); }}
            onClick={(e) => e.stopPropagation()}
          >●</button>
        </div>
      ))}
    </>
  );
});

export function PlotBoardPage({ boardId }: { boardId: string }) {
  const { t } = useTranslation();
  const board = useScriptorium((s) => (s.plotBoards ?? []).find((b) => b.id === boardId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const pushPBHistory = useScriptorium((s) => s.pushPBHistory);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`pb_${boardId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  const stageRef = useRef<HTMLDivElement>(null);
  const [view, scheduleView] = useRafState({ s: 0.5, panX: 60, panY: 20 });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const cardDrag = useRef<{ id: string; sx: number; sy: number; baseX: number; baseY: number; pushed: boolean } | null>(null);
  const pan = useRef<{ x: number; basePanX: number; y: number; basePanY: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Coalesced drag: at most one moveCard per frame, final position flushed.
  const moveCardRaf = useRafCallback((id: string, x: number, y: number) => {
    useScriptorium.getState().moveCard(id, x, y);
  });

  useEffect(() => {
    if (!board) pushToast("error", t("plotboard.page.notFound"));
  }, [board, pushToast, t]);

  const cardById = useMemo(() => new Map((board?.cards ?? []).map((c) => [c.id, c])), [board?.cards]);

  // Wheel zoom on a native non-passive listener (React onWheel is passive at
  // the root); chained functional updates keep rapid wheel bursts exact.
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
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [scheduleView]);

  if (!board) return null;

  // Stable delegates for the memoized card layer (resolved at event time).
  const cardHandlersRef = useRef<{
    cardDown(c: PlotCard, e: React.PointerEvent): void;
    connect(c: PlotCard): void;
  } | null>(null);
  cardHandlersRef.current = {
    cardDown: (c, e) => {
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
    },
    connect: (c) => { setConnecting(c.id); setGhost(null); },
  };
  const handleCardDown = useCallback((c: PlotCard, e: React.PointerEvent) => cardHandlersRef.current?.cardDown(c, e), []);
  const handleConnect = useCallback((c: PlotCard) => cardHandlersRef.current?.connect(c), []);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="plotboard-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label={t("plotboard.page.name")}
          value={board.name}
          onChange={(e) => useScriptorium.getState().renamePlotBoard(boardId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label={t("plotboard.page.undo")} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoPB(boardId)}>↶</button>
          <button type="button" aria-label={t("plotboard.page.redo")} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoPB(boardId)}>↷</button>
          {!board.hasPrologue ? (
            <button type="button" onClick={() => { pushPBHistory(boardId); useScriptorium.getState().setBoardFlags(boardId, { hasPrologue: true }); }}>{t("plotboard.page.prologue")}</button>
          ) : null}
          {!board.hasEpilogue ? (
            <button type="button" onClick={() => { pushPBHistory(boardId); useScriptorium.getState().setBoardFlags(boardId, { hasEpilogue: true }); }}>{t("plotboard.page.epilogue")}</button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              pushPBHistory(boardId);
              const el = stageRef.current;
              if (!el || !el.clientWidth) return;
              const v = viewRef.current;
              const x = (el.clientWidth / 2 - v.panX) / v.s;
              const y = (el.clientHeight / 2 - v.panY) / v.s;
              const created = useScriptorium.getState().addCard(boardId, { x, y, actId: board.acts[0]?.id });
              if (created) setSelectedCardId(created.id);
            }}
          >
            {t("plotboard.page.addScene")}
          </button>
          <button type="button" aria-pressed={notesOpen} onClick={() => setNotesOpen((v) => !v)}>{t("plotboard.page.notes")}</button>
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
            pan.current = { x: e.clientX, y: e.clientY, basePanX: viewRef.current.panX, basePanY: viewRef.current.panY };
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
                moveCardRaf(d.id, d.baseX + dx / viewRef.current.s, d.baseY + dy / viewRef.current.s);
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
          onPointerUp={() => {
            moveCardRaf.flush();
            scheduleView.flush();
            cardDrag.current = null;
            pan.current = null;
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
              <PBWiresLayer wires={board.wires} cardById={cardById} />
              {connecting ? (() => {
                const a = cardById.get(connecting);
                if (!a || !ghost) return null;
                return <line data-testid="pending-conn" className="[stroke:var(--gold)] [stroke-width:2] [stroke-dasharray:6_6]" x1={a.x} y1={a.y} x2={ghost.x / viewRef.current.s} y2={ghost.y / viewRef.current.s} />;
              })() : null}
            </svg>
            <PBCardsLayer cards={board.cards} selectedCardId={selectedCardId} handleCardDown={handleCardDown} handleConnect={handleConnect} />
          </div>
          {board.cards.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[calc(1/var(--bl-scale,0.1))] text-slate whitespace-nowrap">{t("plotboard.page.emptyHint")}</div>
          ) : connecting ? (
            <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 bg-night-2 border border-line text-parchment-dim px-3 py-1.5 rounded-lg text-[13px]">{t("plotboard.page.chooseScene")}</div>
          ) : null}
          {notesOpen ? <BoardNotepad notes={board.notes} onNotes={(v) => useScriptorium.getState().setBoardNotes(boardId, v)} onClose={() => setNotesOpen(false)} /> : null}
        </div>
        <PlotBoardPanel board={board} selectedId={selectedCardId} onSelect={setSelectedCardId} />
      </div>
    </div>
  );
}

