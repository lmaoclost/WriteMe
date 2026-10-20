import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { categoryIcon, categoryLabel, CATEGORY_CANONICAL } from "../entries/categories";
import type { WorldEntry } from "../../domain/types";


export function BloodlineCanvasPage({ bloodlineId }: { bloodlineId: string }) {
  const { t } = useTranslation();
  const bloodline = useScriptorium((s) => s.bloodlines.find((b) => b.id === bloodlineId));
  const images = useScriptorium((s) => s.images);
  const projectEntries = useScriptorium(
    useShallow((s) => s.entries.filter((e) => e.projectId === bloodline?.projectId)),
  );
  const pushToast = useScriptorium((s) => s.pushToast);
  const stageRef = useRef<HTMLDivElement>(null);
  const plane = usePlane(stageRef);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  useBoardNotesHotkey(notesOpen, setNotesOpen);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`bl_${bloodlineId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));

  useEffect(() => {
    if (!bloodline) pushToast("error", t("bloodline.canvas.notFound"));
  }, [bloodline, pushToast, t]);

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

  const characterEntries = useMemo(
    () => projectEntries.filter((e) => (CATEGORY_CANONICAL[e.category] ?? e.category) === "character"),
    [projectEntries],
  );
  const addQueryNorm = addQuery.trim().toLocaleLowerCase();
  const addMatches = characterEntries.filter((e) => e.title.toLocaleLowerCase().includes(addQueryNorm));

  const createPerson = (entry?: WorldEntry) => {
    const rect = stageRef.current?.getBoundingClientRect();
    useScriptorium.getState().pushBLHistory(bloodlineId);
    const p = useScriptorium.getState().addPerson(bloodlineId, {
      x: rect ? (window.innerWidth / 2 - rect.left - plane.panX) / plane.scale : 4000,
      y: rect ? (window.innerHeight / 2 - rect.top - plane.panY) / plane.scale : 4000,
      ...(entry ? { name: entry.title, entryId: entry.id } : {}),
    });
    if (p) setSelectedId(p.id);
    setAddOpen(false);
    setAddQuery("");
  };

  const entryImageKey = (personId: string): string | undefined => {
    const person = bloodline.persons.find((p) => p.id === personId);
    if (person?.portraitKey) return person.portraitKey;
    const entry = person?.entryId ? projectEntries.find((e) => e.id === person.entryId) : undefined;
    return entry?.imageKey;
  };

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="bloodline-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label={t("bloodline.canvas.name")}
          value={bloodline.name}
          onChange={(e) => useScriptorium.getState().renameBloodline(bloodlineId, e.target.value)}
        />
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label={t("bloodline.canvas.undo")} className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => useScriptorium.getState().undoBL(bloodlineId)}>↶</button>
          <button type="button" aria-label={t("bloodline.canvas.redo")} className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => useScriptorium.getState().redoBL(bloodlineId)}>↷</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => setAddOpen(true)}>{t("bloodline.canvas.addPerson")}</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => {
            useScriptorium.getState().pushBLHistory(bloodlineId);
            const rect = stageRef.current?.getBoundingClientRect();
            const h = useScriptorium.getState().addHouse(bloodlineId, {
              x: rect ? (window.innerWidth / 2 - rect.left - plane.panX) / plane.scale + 200 : 4200,
              y: rect ? (window.innerHeight / 2 - rect.top - plane.panY) / plane.scale - 200 : 3800,
            });
            if (h) setSelectedId(h.id);
          }}>{t("bloodline.canvas.newHouse")}</button>
          <button type="button" onClick={() => setFindOpen((v) => !v)} aria-label={t("bloodline.canvas.searchPerson")} className={BOARD_ACTION_BTN}>{t("bloodline.canvas.search")}</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>{t("bloodline.canvas.notes")}</button>
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
                fallbackPortraitKey={entryImageKey(p.id)}
                houseName={houseById.get(p.houseId ?? "")?.name}
                handlers={nodeHandlers}
              />
            ))}
          </div>
          {bloodline.persons.length === 0 && bloodline.houses.length === 0 ? (
            <div className="board-empty-hint absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate text-center">{t("bloodline.canvas.startHint")}</div>
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
      {addOpen ? (
        <Modal title={t("bloodline.canvas.pickPerson")} onClose={() => setAddOpen(false)}>
          <div className="grid gap-3">
            <p className="m-0 text-[13px] text-parchment-dim">{t("bloodline.canvas.pickPersonHint")}</p>
            <input
              className="w-full bg-ink border border-line rounded-sm text-parchment px-2 py-1.5"
              aria-label={t("bloodline.canvas.searchPeople")}
              placeholder={t("bloodline.canvas.searchPeople")}
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              autoFocus
            />
            {characterEntries.length === 0 ? (
              <p className="m-0 text-[13px] text-slate">{t("bloodline.canvas.noCharacters")}</p>
            ) : (
              <ul className="link-list list-none m-0 p-0 grid gap-0.5 max-h-[280px] overflow-y-auto [&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:gap-2 [&_button]:text-left [&_button]:bg-none [&_button]:border-0 [&_button]:text-parchment [&_button]:text-[13px] [&_button]:py-1.5 [&_button]:px-2 [&_button]:rounded-sm hover:[&_button]:bg-night">
                {addMatches.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => createPerson(entry)}>
                      <span aria-hidden="true">{categoryIcon(entry.category)}</span>
                      <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                      <span className="text-[10px] uppercase tracking-[0.08em] text-slate">{categoryLabel(entry.category)}</span>
                    </button>
                  </li>
                ))}
                {addMatches.length === 0 ? <li className="px-2 py-1.5 text-[13px] text-slate">{t("entries.list.noResults")}</li> : null}
              </ul>
            )}
            <Button kind="ghost" className="justify-self-start" onClick={() => createPerson()}>
              {t("bloodline.canvas.blankPerson")}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
