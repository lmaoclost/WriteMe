import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { usePlane } from "./usePlane";
import { EdgesLayer, HouseNode, PersonNode } from "./NodesLayer";
import { BloodlinePanel } from "./BloodlinePanel";
import { FindBar } from "./FindBar";
import { Notepad } from "./Notepad";
import "./bloodline.css";

export function BloodlineCanvasPage({ bloodlineId }: { bloodlineId: string }) {
  const bloodline = useScriptorium((s) => s.bloodlines.find((b) => b.id === bloodlineId));
  const images = useScriptorium((s) => s.images);
  const pushToast = useScriptorium((s) => s.pushToast);
  const stageRef = useRef<HTMLDivElement>(null);
  const plane = usePlane(stageRef);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
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
    const t = setTimeout(() => plane.fitToContainer(), 0);
    return () => clearTimeout(t);
    // fit once on mount
  }, [bloodline?.id]);

  if (!bloodline) return null;

  // Drag base: the person position when the current drag started (set on
  // select via the panel wiring below; the node's pointerdown reports deltas).
  let dragBase = { x: 0, y: 0 };

  const selected = bloodline.persons.find((p) => p.id === selectedId)
    ?? bloodline.houses.find((h) => h.id === selectedId);

  const selectNode = (id: string | null) => {
    const sel = bloodline.persons.find((p) => p.id === id);
    if (sel) dragBase = { x: sel.x, y: sel.y };
    setSelectedId(id);
  };

  return (
    <div className="bloodline-page" data-testid="bloodline-page">
      <header className="bl-header">
        <input
          className="bl-name"
          aria-label="Nome da linhagem"
          value={bloodline.name}
          onChange={(e) => useScriptorium.getState().renameBloodline(bloodlineId, e.target.value)}
        />
        <div className="bl-actions">
          <button type="button" aria-label="Desfazer" disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoBL(bloodlineId)}>↶</button>
          <button type="button" aria-label="Refazer" disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoBL(bloodlineId)}>↷</button>
          <button type="button" onClick={() => {
            useScriptorium.getState().pushBLHistory(bloodlineId);
            const rect = stageRef.current?.getBoundingClientRect();
            const p = useScriptorium.getState().addPerson(bloodlineId, {
              x: rect ? (window.innerWidth / 2 - rect.left - plane.panX) / plane.scale : 4000,
              y: rect ? (window.innerHeight / 2 - rect.top - plane.panY) / plane.scale : 4000,
            });
            if (p) setSelectedId(p.id);
          }}>Adicionar pessoa</button>
          <button type="button" onClick={() => {
            useScriptorium.getState().pushBLHistory(bloodlineId);
            const rect = stageRef.current?.getBoundingClientRect();
            const h = useScriptorium.getState().addHouse(bloodlineId, {
              x: rect ? (window.innerWidth / 2 - rect.left - plane.panX) / plane.scale + 200 : 4200,
              y: rect ? (window.innerHeight / 2 - rect.top - plane.panY) / plane.scale - 200 : 3800,
            });
            if (h) setSelectedId(h.id);
          }}>Nova casa</button>
          <button type="button" onClick={() => setFindOpen((v) => !v)} aria-label="Buscar pessoa">Buscar</button>
          <button type="button" onClick={() => setNotesOpen((v) => !v)} aria-label="Notas">Notas</button>
        </div>
      </header>
      <div className="bl-body">
        <div className="bl-canvas" data-testid="bl-canvas" ref={stageRef}
          onPointerDown={plane.onPointerDown}
          onPointerMove={plane.onPointerMove}
          onPointerUp={plane.onPointerUp}
          onTouchStart={plane.onTouchStart}
          onTouchMove={plane.onTouchMove}
          onTouchEnd={plane.onTouchEnd}
        >
          <div className="bl-plane" data-testid="bl-plane"
            style={{
              width: plane.planeW, height: plane.planeH,
              transform: `translate(${plane.panX}px, ${plane.panY}px) scale(${plane.scale})`,
              transformOrigin: "0 0",
            }}
          >
            <EdgesLayer persons={bloodline.persons} selected={selectedId} />
            {bloodline.houses.map((h) => (
              <HouseNode key={h.id} house={h} selected={h.id === selectedId}
                onSelect={() => selectNode(h.id)} />
            ))}
            {bloodline.persons.map((p) => (
              <PersonNode key={p.id} person={p} images={images} selected={p.id === selectedId}
                onSelect={() => selectNode(p.id)}
                onDelete={() => useScriptorium.getState().deletePerson(p.id)}
                onDragStart={() => useScriptorium.getState().pushBLHistory(bloodlineId)}
                onDragMove={(dx, dy) => {
                  const start = { x: p.x, y: p.y };
                  void start;
                  useScriptorium.getState().movePerson(p.id, dragBase.x + dx / plane.scale, dragBase.y + dy / plane.scale);
                }}
                onDragEnd={() => { dragBase = { x: 0, y: 0 }; }}
              />
            ))}
          </div>
          {bloodline.persons.length === 0 && bloodline.houses.length === 0 ? (
            <div className="bl-empty">Comece pelo fundador — adicione a primeira pessoa.</div>
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
      <div className="bl-selected-sentinel" data-selected-id={selected?.id ?? ""} />
    </div>
  );
}
