import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { usePlane } from "./usePlane";
import { EdgesLayer, HouseNode, PersonNode, type NodeHandlers } from "./NodesLayer";
import type { NodeKind } from "./nodeTypes";
import { BloodlinePanel } from "./BloodlinePanel";
import { FindBar } from "./FindBar";
import { Notepad } from "./Notepad";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN } from "../../ui/board";
import { useBoardNotesHotkey } from "../../ui/boardNotes";
import { useRafCallback } from "../../ui/useRaf";


export function BloodlineCanvasPage({ bloodlineId }: { bloodlineId: string }) {
  const bloodline = useScriptorium((s) => s.bloodlines.find((b) => b.id === bloodlineId));
  const images = useScriptorium((s) => s.images);
  const pushToast = useScriptorium((s) => s.pushToast);
  const stageRef = useRef<HTMLDivElement>(null);
  const plane = usePlane(stageRef);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`bl_${bloodlineId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  useEffect(() => {
    if (!bloodline) pushToast("error", "Bloodline not found.");
  }, [bloodline, pushToast]);

  const planeSize = useMemo(() => {
    let size = 20000;
    for (const p of bloodline?.persons ?? []) if (p.x + 4000 > size) size = p.x + 4000;
    for (const h of bloodline?.houses ?? []) if (h.y + 4000 > size) size = h.y + 4000;
    return Math.ceil(size / 10000) * 10000;
  }, [bloodline]);

  useEffect(() => { plane.setPlaneSize(planeSize, planeSize); }, [plane, planeSize]);

  useEffect(() => {
    if (!bloodline) return;
    // fit to the content bounds — the 20k plane itself must never define the view
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const scan = (x: number, y: number) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };
    for (const p of bloodline.persons) scan(p.x, p.y);
    for (const h of bloodline.houses) scan(h.x, h.y);
    if (minX === Infinity) return;
    const t = setTimeout(() => plane.fitToContent({
      minX, maxX, minY, maxY,
    }), 0);
    return () => clearTimeout(t);
    // fit once on mount
  }, [bloodline?.id]);

  if (!bloodline) return null;

  // Drag base: the node position when the drag started. Ref, not render
  // state — select/drag callbacks must agree across re-renders.
  const dragBaseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const selected = bloodline.persons.find((p) => p.id === selectedId)
    ?? bloodline.houses.find((h) => h.id === selectedId);

  const selectNode = (id: string | null) => {
    const sel = bloodline.persons.find((p) => p.id === id)
      ?? bloodline.houses.find((h) => h.id === id);
    if (sel) dragBaseRef.current = { x: sel.x, y: sel.y };
    setSelectedId(id);
  };

  // O(houses×persons) → two Maps built once per render.
  const memberCountByHouse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of bloodline.persons) {
      if (!p.houseId) continue;
      counts.set(p.houseId, (counts.get(p.houseId) ?? 0) + 1);
    }
    return counts;
  }, [bloodline.persons]);
  const houseById = useMemo(() => new Map(bloodline.houses.map((h) => [h.id, h])), [bloodline.houses]);

  // Coalesced drags: movePerson/moveHouse at most once per frame, final
  // position flushed on drag end.
  const moveNodeRaf = useRafCallback((kind: NodeKind, id: string, x: number, y: number) => {
    if (kind === "person") useScriptorium.getState().movePerson(id, x, y);
    else useScriptorium.getState().moveHouse(id, x, y);
  });

  const nodeHandlersRef = useRef<NodeHandlers | null>(null);
  nodeHandlersRef.current = {
    onSelect: (kind, id) => { void kind; selectNode(id); },
    onDelete: (kind, id) => { if (kind === "person") useScriptorium.getState().deletePerson(id); },
    onDragStart: () => useScriptorium.getState().pushBLHistory(bloodlineId),
    onDragMove: (kind, id, dx, dy) => {
      moveNodeRaf(kind, id, dragBaseRef.current.x + dx / plane.scale, dragBaseRef.current.y + dy / plane.scale);
    },
    onDragEnd: () => { moveNodeRaf.flush(); dragBaseRef.current = { x: 0, y: 0 }; },
  };
  const nodeHandlers = useMemo(() => ({
    onSelect: (kind: NodeKind, id: string) => nodeHandlersRef.current?.onSelect(kind, id),
    onDelete: (kind: NodeKind, id: string) => nodeHandlersRef.current?.onDelete(kind, id),
    onDragStart: (kind: NodeKind, id: string) => nodeHandlersRef.current?.onDragStart(kind, id),
    onDragMove: (kind: NodeKind, id: string, dx: number, dy: number) => nodeHandlersRef.current?.onDragMove(kind, id, dx, dy),
    onDragEnd: (kind: NodeKind, id: string) => nodeHandlersRef.current?.onDragEnd(kind, id),
  }), []);

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="bloodline-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label="Nome da linhagem"
          value={bloodline.name}
          onChange={(e) => useScriptorium.getState().renameBloodline(bloodlineId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label="Desfazer" className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoBL(bloodlineId)}>↶</button>
          <button type="button" aria-label="Refazer" className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoBL(bloodlineId)}>↷</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => {
            useScriptorium.getState().pushBLHistory(bloodlineId);
            const rect = stageRef.current?.getBoundingClientRect();
            const p = useScriptorium.getState().addPerson(bloodlineId, {
              x: rect ? (window.innerWidth / 2 - rect.left - plane.panX) / plane.scale : 4000,
              y: rect ? (window.innerHeight / 2 - rect.top - plane.panY) / plane.scale : 4000,
            });
            if (p) setSelectedId(p.id);
          }}>Adicionar pessoa</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => {
            useScriptorium.getState().pushBLHistory(bloodlineId);
            const rect = stageRef.current?.getBoundingClientRect();
            const h = useScriptorium.getState().addHouse(bloodlineId, {
              x: rect ? (window.innerWidth / 2 - rect.left - plane.panX) / plane.scale + 200 : 4200,
              y: rect ? (window.innerHeight / 2 - rect.top - plane.panY) / plane.scale - 200 : 3800,
            });
            if (h) setSelectedId(h.id);
          }}>Nova casa</button>
          <button type="button" onClick={() => setFindOpen((v) => !v)} aria-label="Buscar pessoa" className={BOARD_ACTION_BTN}>Buscar</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>Notes ✎</button>
        </div>
      </header>
      <div className="grid grid-cols-[1fr_300px] min-h-0 overflow-hidden max-[720px]:grid-cols-1 max-[720px]:grid-rows-[45vh_minmax(0,1fr)]">
        <div className="relative overflow-hidden bg-ink cursor-grab active:cursor-grabbing" data-testid="bl-canvas" ref={stageRef}
          onPointerDown={plane.onPointerDown}
          onPointerMove={plane.onPointerMove}
          onPointerUp={plane.onPointerUp}
          onTouchStart={plane.onTouchStart}
          onTouchMove={plane.onTouchMove}
          onTouchEnd={plane.onTouchEnd}
        >
          <div className="absolute bg-[radial-gradient(circle_at_25%_25%,#17162a,var(--ink)_65%)] shadow-[inset_0_0_0_1px_var(--line)]" data-testid="bl-plane"
            style={{
              width: plane.planeW, height: plane.planeH,
              transform: `translate(${plane.panX}px, ${plane.panY}px) scale(${plane.scale})`,
              transformOrigin: "0 0",
            }}
          >
            <EdgesLayer persons={bloodline.persons} selected={selectedId} />
            {bloodline.houses.map((h) => (
              <HouseNode key={h.id} house={h} selected={h.id === selectedId}
                memberCount={memberCountByHouse.get(h.id) ?? 0}
                handlers={nodeHandlers}
              />
            ))}
            {bloodline.persons.map((p) => (
              <PersonNode key={p.id} person={p} images={images} selected={p.id === selectedId}
                houseName={houseById.get(p.houseId ?? "")?.name}
                handlers={nodeHandlers}
              />
            ))}
          </div>
          {bloodline.persons.length === 0 && bloodline.houses.length === 0 ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[calc(1/var(--bl-scale,0.1))] text-slate whitespace-nowrap">Comece pelo fundador — adicione a primeira pessoa.</div>
          ) : null}
        </div>
        <BloodlinePanel bloodline={bloodline} selectedId={selectedId} onSelect={setSelectedId} />
        {findOpen ? <FindBar persons={bloodline.persons} onPick={(id) => {
          const p = bloodline.persons.find((x) => x.id === id);
          if (p) plane.centerOn(p.x, p.y);
          setSelectedId(id);
          setFindOpen(false);
        }} onClose={() => setFindOpen(false)} /> : null}
        {notesOpen ? <Notepad notes={bloodline.notes} onNotes={(v) => useScriptorium.getState().setNotes(bloodlineId, v)} onClose={() => setNotesOpen(false)} /> : null}
      </div>
      {selected ? "" : ""}
      <div className="hidden" data-selected-id={selected?.id ?? ""} />
    </div>
  );
}
