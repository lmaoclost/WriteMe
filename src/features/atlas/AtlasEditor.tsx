import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import type { Id, Pt, Region } from "../../domain/types";
import { pointInPolygon, polygonArea } from "../../domain/geometry";
import { selectHistoryFlags, useScriptorium } from "../../data/store";
import { Stage } from "./stage/Stage";
import type { TransformApi } from "./stage/useStageTransform";
import { RegionLayer } from "./stage/RegionLayer";
import { DrawLayer } from "./stage/DrawLayer";
import { PinLayer, type PinHoverState } from "./stage/PinLayer";
import { PinPanel } from "./panels/PinPanel";
import { RegionPanel } from "./panels/RegionPanel";
import { useDraw, type AtlasTool, type DrawMode } from "./useDraw";
import { EntryImagePicker } from "./EntryImagePicker";
import { EntryPreview, entryBlurb } from "../entries/EntryPreview";
import { categoryIcon, categoryLabel } from "../entries/categories";
import { MapDropzone, loadMapIntoAtlas } from "./MapDropzone";

export interface AtlasEditorProps {
  atlasId: string;
  /** Injected by the router wrapper; used to exit to the atlas index when the
   *  atlas vanishes. Direct mounts without it simply skip that branch. */
  projectId?: string;
}

const TOOLTIP_SIZE = { width: 180, height: 48 } as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const ZOOM_IN = 1.25;
const ZOOM_OUT = 0.8;

const DRAW_MODES: Array<{ value: Exclude<DrawMode, "none">; label: string }> = [
  { value: "carve", label: "Carve" },
  { value: "neighbor", label: "Vizinho" },
  { value: "fit", label: "Encaixe" },
];

function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function smallestContaining(pt: Pt, regions: Region[]): Id | null {
  return regions
    .filter((r) => r.points.length >= 3 && pointInPolygon(pt, r.points))
    .sort((a, b) => polygonArea(a.points) - polygonArea(b.points))[0]?.id ?? null;
}

function containingSortedDesc(pt: Pt, regions: Region[]): Region[] {
  return regions
    .filter((r) => r.points.length >= 3 && pointInPolygon(pt, r.points))
    .sort((a, b) => polygonArea(b.points) - polygonArea(a.points));
}

interface ChooserState {
  x: number;
  y: number;
  options: Region[];
}

function RegionChooser({ options, position, onPick, onClear, onClose }: {
  options: Region[];
  position: { x: number; y: number };
  onPick(id: Id): void;
  onClear(): void;
  onClose(): void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="chooser-backdrop fixed inset-0 z-29 bg-transparent" onPointerDown={onClose} aria-hidden="true" />
      <div
        className="region-chooser fixed z-30 flex flex-col min-w-[150px] p-1 bg-night-2 border border-line rounded-lg"
        role="dialog"
        aria-label="Pick region"
        style={{ left: position.x, top: position.y }}
      >
        {options.map((r) => (
          <button type="button" key={r.id} onClick={() => onPick(r.id)} className="bg-none border-0 rounded-lg text-parchment px-2.5 py-1.5 text-left hover:bg-night">
            {r.label || "Region"}
          </button>
        ))}
        <button type="button" onClick={onClear} className="bg-none border-0 rounded-lg text-parchment px-2.5 py-1.5 text-left hover:bg-night">None</button>
      </div>
    </>
  );
}

export function AtlasEditor({ atlasId, projectId }: AtlasEditorProps) {
  const atlas = useScriptorium((s) => s.atlases.find((a) => a.id === atlasId));
  const navigate = useNavigate();
  const allEntries = useScriptorium((s) => s.entries);
  const images = useScriptorium((s) => s.images);
  const flags = useScriptorium(useShallow(selectHistoryFlags(atlasId)));
  const pushToast = useScriptorium((s) => s.pushToast);
  const [tool, setTool] = useState<AtlasTool>("select");
  const [mode, setMode] = useState<DrawMode>("none");
  const [selectedRegionId, setSelectedRegionId] = useState<Id | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<Id | null>(null);
  const [hover, setHover] = useState<PinHoverState | null>(null);
  const [chooser, setChooser] = useState<ChooserState | null>(null);
  const [nameDraft, setNameDraft] = useState(atlas?.name ?? "");
  const [armDelete, setArmDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoom, setZoom] = useState(0);
  const apiRef = useRef<TransformApi | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  // True right after an explicit delete — suppresses the "not found" toast.
  const deletedRef = useRef(false);
  const draw = useDraw({
    atlasId,
    transformApi: apiRef,
    tool,
    mode,
    onFinish: (region) => setSelectedRegionId(region.id),
  });
  const { drawing, cancelDraw, attemptFinishRegion, confirmCarve } = draw;

  const projectEntries = useMemo(
    () => allEntries.filter((e) => e.projectId === atlas?.projectId),
    [allEntries, atlas],
  );

  useEffect(() => {
    setNameDraft(atlas?.name ?? "");
  }, [atlas?.name, atlasId]);

  useEffect(() => {
    setArmDelete(false);
    setPickerOpen(false);
  }, [atlasId]);

  const commitName = useCallback(() => {
    const name = nameDraft.trim();
    if (!name || name === atlas?.name) return;
    useScriptorium.getState().renameAtlas(atlasId, name);
  }, [atlasId, atlas?.name, nameDraft]);

  const runUndo = useCallback(() => useScriptorium.getState().undo(atlasId), [atlasId]);
  const runRedo = useCallback(() => useScriptorium.getState().redo(atlasId), [atlasId]);

  const confirmPreview = useCallback(() => {
    const region = confirmCarve();
    if (region) setTool("select");
  }, [confirmCarve]);

  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDraw();
      else if (e.key === "Enter" && draw.carvePreview) confirmPreview();
      else if (e.key === "Enter") attemptFinishRegion();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawing, cancelDraw, attemptFinishRegion, confirmPreview, draw.carvePreview]);

  // Ctrl+z / Ctrl+Shift+z / Ctrl+y mirror the header buttons; text entry keeps
  // its own undo semantics.
  useEffect(() => {
    if (!atlasId) return;
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) runRedo();
        else runUndo();
      } else if (key === "y") {
        e.preventDefault();
        runRedo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [atlasId, runRedo, runUndo]);

  // A missing atlas (unknown id, or it was just deleted) exits to the index.
  useEffect(() => {
    if (!atlas && !deletedRef.current) {
      deletedRef.current = true;
      useScriptorium.getState().pushToast("error", "Atlas not found.");
    }
  }, [atlas]);

  // Selections may outlive their pin or region (undo/delete) — drop them when
  // the selected id vanishes.
  useEffect(() => {
    if (!selectedPinId && !selectedRegionId) return;
    const s = useScriptorium.getState();
    const current = s.atlases.find((a) => a.id === atlasId);
    if (!current) return;
    if (selectedPinId && !current.pins.some((p) => p.id === selectedPinId)) setSelectedPinId(null);
    if (selectedRegionId && !current.regions.some((r) => r.id === selectedRegionId)) setSelectedRegionId(null);
  }, [atlasId, atlas, selectedPinId, selectedRegionId]);

  // Delete key on the selected pin: direct delete (store pushes history).
  useEffect(() => {
    if (!selectedPinId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      if (isEditableTarget(e.target)) return;
      const s = useScriptorium.getState();
      if (s.atlases.some((a) => a.id === atlasId && a.pins.some((p) => p.id === selectedPinId))) {
        s.deletePin(selectedPinId);
        setSelectedPinId(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [atlasId, selectedPinId]);

  if (!atlas) {
    return <Navigate to={projectId ? `/p/${projectId}/atlas` : "/"} replace />;
  }

  const selectedPin = atlas.pins.find((p) => p.id === selectedPinId) ?? null;
  const selectedRegion = atlas.regions.find((r) => r.id === selectedRegionId) ?? null;
  const hoveredPin = hover ? atlas.pins.find((p) => p.id === hover.pinId) ?? null : null;
  const hoverEntryTitle = hoveredPin?.entryId
    ? projectEntries.find((e) => e.id === hoveredPin.entryId)?.title
    : undefined;
  // click-pop preview: select a pin/region with a linked entry → popup near it
  const previewEntry = selectedPin?.entryId ?? selectedRegion?.entryId ?? null;
  const previewEntryObj = previewEntry ? projectEntries.find((e) => e.id === previewEntry) : undefined;
  const closePreview = () => { setSelectedPinId(null); setSelectedRegionId(null); };

  const handleStageClick = (pt: Pt, clientX: number, clientY: number) => {
    if (tool === "pin") {
      const pin = useScriptorium.getState().addPin(atlasId, { x: clamp01(pt.x), y: clamp01(pt.y) });
      if (pin) setSelectedPinId(pin.id);
      return;
    }
    if (tool === "region") {
      draw.onStageClick(pt, clientX, clientY);
      return;
    }
    if (tool === "select") setSelectedRegionId(smallestContaining(pt, atlas.regions));
  };

  const handleStageMove = (pt: Pt, clientX: number, clientY: number) => {
    draw.onStageMove(pt, clientX, clientY);
  };

  const handleStageDblClick = (pt: Pt, clientX: number, clientY: number) => {
    if (tool === "region") {
      draw.onStageDblClick(pt, clientX, clientY);
      return;
    }
    if (tool === "select") {
      const options = containingSortedDesc(pt, atlas.regions);
      if (options.length >= 2) setChooser({ x: clientX, y: clientY, options });
    }
  };

  const deleteFromHeader = () => {
    if (!armDelete) {
      setArmDelete(true);
      return;
    }
    deletedRef.current = true;
    useScriptorium.getState().deleteAtlas(atlasId);
    pushToast("success", "Atlas deleted.");
  };

  const onReplaceFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void loadMapIntoAtlas(atlasId, f, pushToast);
    e.target.value = "";
  };

  const tools: Array<{ name: string; label: string; value: AtlasTool }> = [
    { name: "Move tool", label: "Select / move", value: "select" },
    { name: "Pin tool", label: "Add pin", value: "pin" },
    { name: "Draw region", label: "Region", value: "region" },
  ];

  return (
    <div className="atlas-editor relative flex flex-col h-full [&[data-tool=region]_.stage]:cursor-crosshair" data-tool={tool}>
      <header className="flex items-center gap-2.5 px-3 py-2 bg-night border-b border-line flex-wrap">
        <input
          className="editor-name-input w-[190px] min-w-[120px] font-mono text-base text-parchment bg-none border border-transparent rounded-lg px-1.5 py-1 hover:border-line focus:border-gold outline-none"
          aria-label="Nome do atlas"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
              commitName();
            }
          }}
          onBlur={commitName}
        />
        <div className="flex items-center gap-1.5" role="toolbar" aria-label="Atlas tools">
          {tools.map((t) => (
            <button
              type="button"
              key={t.value}
              aria-label={t.name}
              aria-pressed={tool === t.value}
              className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold"
              onClick={() => setTool(t.value)}
            >
              {t.label}
            </button>
          ))}
          {tool === "region" ? (
            <>
              <span className="text-[11px] text-slate whitespace-nowrap" aria-hidden="true">
                Esc cancela · Enter fecha
              </span>
              {DRAW_MODES.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold"
                  aria-pressed={mode === m.value}
                  onClick={() => setMode((cur) => (cur === m.value ? "none" : m.value))}
                >
                  {m.label}
                </button>
              ))}
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 ml-auto" role="toolbar" aria-label="Zoom do mapa">
          <button type="button" aria-label="Reduzir" className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold w-7 text-center" onClick={() => apiRef.current?.zoomBy(ZOOM_OUT)}>−</button>
          <output className="font-mono text-xs text-parchment-dim min-w-[44px] text-center" aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
          <button type="button" aria-label="Ampliar" className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold w-7 text-center" onClick={() => apiRef.current?.zoomBy(ZOOM_IN)}>+</button>
          <button type="button" className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold" onClick={() => apiRef.current?.fitToContainer()}>Ajustar</button>
        </div>
        <div className="flex items-center gap-1.5 ml-auto" role="toolbar" aria-label="Atlas actions">
          <button
            type="button"
            className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold w-[30px] text-center"
            aria-label="Desfazer"
            title="Desfazer"
            disabled={!flags.canUndo}
            onClick={runUndo}
          >
            ↶
          </button>
          <button
            type="button"
            className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold w-[30px] text-center"
            aria-label="Refazer"
            title="Refazer"
            disabled={!flags.canRedo}
            onClick={runRedo}
          >
            ↷
          </button>
          <button type="button" className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold" onClick={() => replaceInputRef.current?.click()}>Replace map</button>
          <button type="button" className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold" onClick={() => setPickerOpen(true)}>Entry image</button>
          <button
            type="button"
            className="danger-btn border-[var(--ember)] text-[var(--ember)] hover:bg-[color-mix(in_srgb,var(--ember)_18%,transparent)] bg-none rounded-lg py-1 px-2.5 text-[13px] cursor-pointer transition-colors"
            aria-label="Excluir atlas"
            onClick={deleteFromHeader}
          >
            {armDelete ? "Confirmar?" : "Excluir atlas"}
          </button>
        </div>
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Arquivo do mapa"
          onChange={onReplaceFile}
        />
      </header>
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 min-w-0 min-h-0 relative">
          <Stage
            atlas={atlas}
            onStageClick={handleStageClick}
            onStageMove={handleStageMove}
            onStageDblClick={handleStageDblClick}
            onTransformChange={(t) => setZoom(t.scale)}
            overlayChildren={(api) => (
              <>
                <PinLayer
                  atlasId={atlasId}
                  pins={atlas.pins}
                  transformApi={api}
                  interactive={tool !== "region"}
                  selectedPinId={selectedPinId}
                  onSelectPin={setSelectedPinId}
                  onHoverEnter={(pinId, cursor, stage) => setHover({ pinId, cursor, stage })}
                  onHoverLeave={() => setHover(null)}
                />
                {hoveredPin ? (
                  (() => {
                    const left = hover!.stage.w > 0
                      ? Math.max(0, Math.min(hover!.cursor.x + 12, hover!.stage.w - TOOLTIP_SIZE.width))
                      : hover!.cursor.x + 12;
                    const top = hover!.stage.h > 0
                      ? Math.max(0, Math.min(hover!.cursor.y - TOOLTIP_SIZE.height, hover!.stage.h - TOOLTIP_SIZE.height))
                      : hover!.cursor.y - TOOLTIP_SIZE.height;
                    return (
                      <div className="pin-tooltip absolute z-6 flex flex-col gap-0.5 max-w-[180px] px-2 py-1.5 bg-night-2 border border-line rounded-lg pointer-events-none text-xs" data-testid="pin-tooltip" style={{ left, top }}>
                        <span className="font-semibold text-parchment">{hoveredPin.label || "Pino"}</span>
                        {hoverEntryTitle ? <span className="text-parchment-dim">{hoverEntryTitle}</span> : null}
                      </div>
                    );
                  })()
                ) : null}
                {previewEntryObj ? (() => {
                  const cur = hover?.cursor ?? { x: 24, y: 24 };
                  const st = hover?.stage ?? { w: 0, h: 0 };
                  const left = st.w > 0 ? Math.max(0, Math.min(cur.x + 12, st.w - 300)) : cur.x + 12;
                  const top = st.h > 0 ? Math.max(0, Math.min(cur.y + 14, st.h - 190)) : cur.y + 14;
                  return (
                    <div className="pin-tooltip pin-preview-pop absolute z-44 flex flex-col gap-1 w-[300px] px-3 py-2.5 bg-night-2 border border-gold-dim rounded-lg text-xs" data-testid="pin-entry-preview" style={{ left, top }}>
                      <button type="button" className="pin-preview-close absolute top-1 right-1.5 bg-none border-0 text-slate cursor-pointer text-xs hover:text-parchment" aria-label="Fechar preview" onClick={closePreview}>✕</button>
                      <EntryPreview
                        data={{
                          entryId: previewEntryObj.id,
                          title: previewEntryObj.title,
                          icon: categoryIcon(previewEntryObj.category),
                          categoryLabel: categoryLabel(previewEntryObj.category),
                          blurb: entryBlurb(previewEntryObj.summary, previewEntryObj.body),
                        }}
                        onOpen={(id) => navigate(projectId ? `/p/${projectId}/entries?e=${id}` : "/")}
                      />
                    </div>
                  );
                })() : null}
              </>
            )}
          >
            {(api) => {
              apiRef.current = api;
              return (
                <>
                  <RegionLayer
                    regions={atlas.regions}
                    transformApi={api}
                    selectedRegionId={selectedRegionId}
                    onSelectRegion={setSelectedRegionId}
                    interactive={tool === "select"}
                    carveParentId={draw.carveParentId}
                  />
                  <DrawLayer
                    drawVertices={draw.drawVertices}
                    drawCursor={draw.drawCursor}
                    imgW={api.imgW}
                    imgH={api.imgH}
                    carvePreview={draw.carvePreview}
                    carveSnapPoints={draw.carveSnapPoints}
                  />
                </>
              );
            }}
          </Stage>
          {!atlas.mapImageKey ? <MapDropzone atlasId={atlasId} /> : null}
        </div>
        <aside className="w-[280px] flex-none min-h-0 overflow-y-auto p-3 bg-night border-l border-line flex flex-col gap-3.5" aria-label="Atlas panels">
          {selectedPin ? (
            <PinPanel
              pin={selectedPin}
              entries={projectEntries}
              onDelete={(pinId) => {
                useScriptorium.getState().deletePin(pinId);
                setSelectedPinId(null);
              }}
            />
          ) : selectedRegion ? (
            <RegionPanel
              atlasId={atlasId}
              region={selectedRegion}
              entries={projectEntries}
              onDelete={(regionId) => {
                useScriptorium.getState().deleteRegion(regionId);
                setSelectedRegionId(null);
              }}
            />
          ) : (
            <p className="panel-placeholder text-parchment-dim text-[13px]">Select or create a pin or region.</p>
          )}
        </aside>
      </div>
      {pickerOpen ? (
        <EntryImagePicker
          atlasId={atlasId}
          entries={projectEntries}
          images={images}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      {draw.carvePreview ? (
        <div className="mode-actions absolute left-1/2 bottom-4 -translate-x-1/2 flex gap-2 z-20 px-2 py-1.5 bg-night-2 border border-line rounded-lg" role="toolbar" aria-label="Carve actions">
          <button type="button" className="mode-actions-btn bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] hover:border-gold-dim" onClick={draw.flipCarvePreview}>Outro lado</button>
          <button type="button" className="mode-actions-btn bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] hover:border-gold-dim" onClick={confirmPreview}>Aplicar recorte</button>
          <button type="button" className="mode-actions-btn bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] hover:border-gold-dim" onClick={cancelDraw}>Cancelar</button>
        </div>
      ) : null}
      {chooser ? (
        <RegionChooser
          options={chooser.options}
          position={chooser}
          onPick={(id) => {
            setSelectedRegionId(id);
            setChooser(null);
          }}
          onClear={() => {
            setSelectedRegionId(null);
            setChooser(null);
          }}
          onClose={() => setChooser(null)}
        />
      ) : null}
    </div>
  );
}
