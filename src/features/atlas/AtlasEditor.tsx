import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

const DRAW_MODES = [
  { value: "carve", labelKey: "atlas.editor.carve" },
  { value: "neighbor", labelKey: "atlas.editor.neighbor" },
  { value: "fit", labelKey: "atlas.editor.fit" },
] as const satisfies ReadonlyArray<{ value: Exclude<DrawMode, "none">; labelKey: string }>;

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
  const { t } = useTranslation();
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
        aria-label={t("atlas.editor.pickRegion")}
        style={{ left: position.x, top: position.y }}
      >
        {options.map((r) => (
          <button type="button" key={r.id} onClick={() => onPick(r.id)} className="bg-none border-0 rounded-lg text-parchment px-2.5 py-1.5 text-left hover:bg-night">
            {r.label || t("atlas.editor.regionFallback")}
          </button>
        ))}
        <button type="button" onClick={onClear} className="bg-none border-0 rounded-lg text-parchment px-2.5 py-1.5 text-left hover:bg-night">{t("atlas.editor.none")}</button>
      </div>
    </>
  );
}

export function AtlasEditor({ atlasId, projectId }: AtlasEditorProps) {
  const { t } = useTranslation();
  const atlas = useScriptorium((s) => s.atlases.find((a) => a.id === atlasId));
  const navigate = useNavigate();
  // narrowed: re-render only when this project's rows change — EntryImagePicker
  // subscribes to the images map itself, only while it is open
  const projectEntries = useScriptorium(useShallow((s) => s.entries.filter((e) => e.projectId === atlas?.projectId)));
  const flags = useScriptorium(useShallow(selectHistoryFlags(atlasId)));
  const pushToast = useScriptorium((s) => s.pushToast);
  const [tool, setTool] = useState<AtlasTool>("select");
  const [mode, setMode] = useState<DrawMode>("none");
  const [selectedRegionId, setSelectedRegionId] = useState<Id | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<Id | null>(null);
  const [hover, setHover] = useState<PinHoverState | null>(null);
  const [hoverRegion, setHoverRegion] = useState<{ id: Id; left: number; top: number } | null>(null);
  const [chooser, setChooser] = useState<ChooserState | null>(null);
  const [nameDraft, setNameDraft] = useState(atlas?.name ?? "");
  const [armDelete, setArmDelete] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoom, setZoom] = useState(0);
  const apiRef = useRef<TransformApi | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  // Selection is exclusive: the side panel shows exactly one target.
  const selectPin = useCallback((pinId: Id | null) => {
    setSelectedPinId(pinId);
    if (pinId) setSelectedRegionId(null);
  }, []);
  const selectRegion = useCallback((regionId: Id | null) => {
    setSelectedRegionId(regionId);
    if (regionId) setSelectedPinId(null);
  }, []);
  // True right after an explicit delete — suppresses the "not found" toast.
  const deletedRef = useRef(false);
  const draw = useDraw({
    atlasId,
    transformApi: apiRef,
    tool,
    mode,
    onFinish: (region) => selectRegion(region.id),
  });
  const { drawing, cancelDraw, attemptFinishRegion, confirmCarve } = draw;

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

  // Stable preview ref: the Enter/Escape handler reads it at event time, so a
  // new carvePreview no longer tears down and re-registers the key listener.
  const carvePreviewRef = useRef(draw.carvePreview);
  carvePreviewRef.current = draw.carvePreview;
  const selectedPinRef = useRef(selectedPinId);
  selectedPinRef.current = selectedPinId;
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  // One document keydown router (draw escape/enter, undo/redo, delete pin)
  // instead of four listeners with overlapping churn.
  useEffect(() => {
    if (!atlasId) return;
    const onKey = (e: KeyboardEvent) => {
      if (drawingRef.current) {
        if (e.key === "Escape") { cancelDraw(); return; }
        if (e.key === "Enter") {
          if (carvePreviewRef.current) confirmPreview();
          else attemptFinishRegion();
          return;
        }
      }
      if (isEditableTarget(e.target)) return;
      if (e.key === "Delete" && selectedPinRef.current) {
        const s = useScriptorium.getState();
        if (s.atlases.some((a) => a.id === atlasId && a.pins.some((p) => p.id === selectedPinRef.current))) {
          s.deletePin(selectedPinRef.current);
          setSelectedPinId(null);
        }
        return;
      }
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
  }, [atlasId, attemptFinishRegion, cancelDraw, confirmPreview, runRedo, runUndo]);

  // A missing atlas (unknown id, or it was just deleted) exits to the index.
  useEffect(() => {
    if (!atlas && !deletedRef.current) {
      deletedRef.current = true;
      useScriptorium.getState().pushToast("error", t("atlas.editor.notFound"));
    }
  }, [atlas, t]);

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

  if (!atlas) {
    return <Navigate to={projectId ? `/p/${projectId}/atlas` : "/"} replace />;
  }

  const selectedPin = atlas.pins.find((p) => p.id === selectedPinId) ?? null;
  const selectedRegion = atlas.regions.find((r) => r.id === selectedRegionId) ?? null;
  const hoveredPin = hover ? atlas.pins.find((p) => p.id === hover.pinId) ?? null : null;
  const hoveredRegion = hoverRegion ? atlas.regions.find((r) => r.id === hoverRegion.id) ?? null : null;
  const hoverEntryTitle = hoveredPin?.entryId
    ? projectEntries.find((e) => e.id === hoveredPin.entryId)?.title
    : undefined;
  // click-pop preview: select a pin/region with a linked entry → popup near it.
  // Region hover opens the same preview without selecting.
  const previewEntry = selectedPin?.entryId ?? selectedRegion?.entryId ?? hoveredRegion?.entryId ?? null;
  const previewEntryObj = previewEntry ? projectEntries.find((e) => e.id === previewEntry) : undefined;
  const previewFromHover = !selectedPin && !selectedRegion && !!hoverRegion;
  const closePreview = () => { selectPin(null); selectRegion(null); };
  const selectedPinRegion = selectedPin
    ? atlas.regions.find((r) => r.id === smallestContaining(selectedPin, atlas.regions)) ?? null
    : null;

  const handleStageClick = (pt: Pt, clientX: number, clientY: number) => {
    if (tool === "pin") {
      const pin = useScriptorium.getState().addPin(atlasId, { x: clamp01(pt.x), y: clamp01(pt.y) });
      if (pin) selectPin(pin.id);
      return;
    }
    if (tool === "region") {
      draw.onStageClick(pt, clientX, clientY);
      return;
    }
    if (tool === "select") selectRegion(smallestContaining(pt, atlas.regions));
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
    pushToast("success", t("atlas.editor.deleted"));
  };

  const onReplaceFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void loadMapIntoAtlas(atlasId, f, pushToast);
    e.target.value = "";
  };

  const tools = [
    { nameKey: "atlas.editor.selectMove", labelKey: "atlas.editor.selectMove", value: "select" },
    { nameKey: "atlas.editor.addPin", labelKey: "atlas.editor.addPin", value: "pin" },
    { nameKey: "atlas.editor.region", labelKey: "atlas.editor.region", value: "region" },
  ] as const satisfies ReadonlyArray<{ nameKey: string; labelKey: string; value: AtlasTool }>;

  return (
    <div className="atlas-editor relative flex flex-col h-full [&[data-tool=region]_.stage]:cursor-crosshair" data-tool={tool}>
      <header className="flex items-center gap-2.5 px-3 py-2 bg-night border-b border-line flex-wrap">
        <input
          className="editor-name-input w-[190px] min-w-[120px] font-mono text-base text-parchment bg-none border border-transparent rounded-lg px-1.5 py-1 hover:border-line focus:border-gold outline-none"
          aria-label={t("atlas.editor.name")}
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
        <div className="flex items-center gap-1.5" role="toolbar" aria-label={t("atlas.editor.tools")}>
          {tools.map((toolDef) => (
            <button
              type="button"
              key={toolDef.value}
              aria-label={t(toolDef.nameKey)}
              aria-pressed={tool === toolDef.value}
              className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold"
              onClick={() => setTool(toolDef.value)}
            >
              {t(toolDef.labelKey)}
            </button>
          ))}
          {tool === "region" ? (
            <>
              <span className="text-[11px] text-slate whitespace-nowrap" aria-hidden="true">
                {t("atlas.editor.drawHint")}
              </span>
              {DRAW_MODES.map((m) => (
                <button
                  type="button"
                  key={m.value}
                  className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold"
                  aria-pressed={mode === m.value}
                  onClick={() => setMode((cur) => (cur === m.value ? "none" : m.value))}
                >
                  {t(m.labelKey)}
                </button>
              ))}
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 ml-auto" role="toolbar" aria-label={t("atlas.editor.zoom")}>
          <button type="button" aria-label={t("atlas.editor.zoomOut")} className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold w-7 text-center" onClick={() => apiRef.current?.zoomBy(ZOOM_OUT)}>−</button>
          <output className="font-mono text-xs text-parchment-dim min-w-[44px] text-center" aria-label={t("atlas.editor.zoomLevel")}>{Math.round(zoom * 100)}%</output>
          <button type="button" aria-label={t("atlas.editor.zoomIn")} className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold w-7 text-center" onClick={() => apiRef.current?.zoomBy(ZOOM_IN)}>+</button>
          <button type="button" className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold" onClick={() => apiRef.current?.fitToContainer()}>{t("atlas.editor.fitToContainer")}</button>
        </div>
        <div className="flex items-center gap-1.5 ml-auto" role="toolbar" aria-label={t("atlas.editor.actions")}>
          <button
            type="button"
            className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold w-[30px] text-center"
            aria-label={t("atlas.editor.undo")}
            title={t("atlas.editor.undo")}
            disabled={!flags.canUndo}
            onClick={runUndo}
          >
            ↶
          </button>
          <button
            type="button"
            className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold w-[30px] text-center"
            aria-label={t("atlas.editor.redo")}
            title={t("atlas.editor.redo")}
            disabled={!flags.canRedo}
            onClick={runRedo}
          >
            ↷
          </button>
          <button type="button" className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold" onClick={() => replaceInputRef.current?.click()}>{t("atlas.editor.replaceMap")}</button>
          <button type="button" className="bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] cursor-pointer hover:border-gold-dim disabled:opacity-40 disabled:cursor-default disabled:hover:border-line aria-pressed:border-gold aria-pressed:text-gold" onClick={() => setPickerOpen(true)}>{t("atlas.editor.entryImage")}</button>
          <button
            type="button"
            className="danger-btn border-[var(--ember)] text-[var(--ember)] hover:bg-[color-mix(in_srgb,var(--ember)_18%,transparent)] bg-none rounded-lg py-1 px-2.5 text-[13px] cursor-pointer transition-colors"
            aria-label={t("atlas.editor.delete")}
            onClick={deleteFromHeader}
          >
            {armDelete ? t("atlas.editor.confirm") : t("atlas.editor.delete")}
          </button>
        </div>
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={t("atlas.editor.mapFile")}
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
                  onSelectPin={selectPin}
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
                        <span className="font-semibold text-parchment">{hoveredPin.label || t("atlas.editor.pinFallback")}</span>
                        {hoverEntryTitle ? <span className="text-parchment-dim">{hoverEntryTitle}</span> : null}
                      </div>
                    );
                  })()
                ) : null}
                {previewEntryObj ? (() => {
                  const cur = hover?.cursor ?? { x: 24, y: 24 };
                  const st = hover?.stage ?? { w: 0, h: 0 };
                  const baseLeft = previewFromHover && hoverRegion ? hoverRegion.left + 14 : cur.x + 12;
                  const baseTop = previewFromHover && hoverRegion ? hoverRegion.top + 14 : cur.y + 14;
                  const left = st.w > 0 ? Math.max(0, Math.min(baseLeft, st.w - 300)) : baseLeft;
                  const top = st.h > 0 ? Math.max(0, Math.min(baseTop, st.h - 190)) : baseTop;
                  const interactivePreview = true; // hover pop may be entered; region keeps it open
                  return (
                    <div
                      className={`pin-tooltip pin-preview-pop absolute z-44 flex flex-col gap-1 w-[300px] px-3 py-2.5 bg-night-2 border border-gold-dim rounded-lg text-xs ${interactivePreview ? "pointer-events-auto" : "pointer-events-none"}`}
                      data-testid="pin-entry-preview"
                      style={{ left, top }}
                      onPointerLeave={(e) => {
                        if (previewFromHover) {
                          const to = e.relatedTarget instanceof Element ? e.relatedTarget : null;
                          if (!to || (!to.closest(".pin-preview-pop") && !to.closest(".region-poly"))) {
                            setHoverRegion(null);
                          }
                        }
                      }}
                    >
                      <button type="button" className="pin-preview-close absolute top-1 right-1.5 bg-none border-0 text-slate cursor-pointer text-xs hover:text-parchment" aria-label={t("atlas.editor.closePreview")} onClick={closePreview}>✕</button>
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
                    onSelectRegion={selectRegion}
                    onHoverRegion={(id, at) => setHoverRegion(id && at ? { id, ...at } : null)}
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
        <aside className="w-[280px] flex-none min-h-0 overflow-y-auto p-3 bg-night border-l border-line flex flex-col gap-3.5" aria-label={t("atlas.editor.panels")}>
          {selectedPin ? (
            <PinPanel
              pin={selectedPin}
              entries={projectEntries}
              containingRegion={selectedPinRegion}
              onSelectContainingRegion={() => {
                if (selectedPinRegion) selectRegion(selectedPinRegion.id);
              }}
              onDelete={(pinId) => {
                useScriptorium.getState().deletePin(pinId);
                selectPin(null);
              }}
            />
          ) : selectedRegion ? (
            <RegionPanel
              atlasId={atlasId}
              region={selectedRegion}
              entries={projectEntries}
              onDelete={(regionId) => {
                useScriptorium.getState().deleteRegion(regionId);
                selectRegion(null);
              }}
            />
          ) : (
            <p className="panel-placeholder text-parchment-dim text-[13px]">{t("atlas.editor.placeholder")}</p>
          )}
        </aside>
      </div>
      {pickerOpen ? (
        <EntryImagePicker
          atlasId={atlasId}
          entries={projectEntries}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      {draw.carvePreview ? (
        <div className="mode-actions absolute left-1/2 bottom-4 -translate-x-1/2 flex gap-2 z-20 px-2 py-1.5 bg-night-2 border border-line rounded-lg" role="toolbar" aria-label={t("atlas.editor.carveActions")}>
          <button type="button" className="mode-actions-btn bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] hover:border-gold-dim" onClick={draw.flipCarvePreview}>{t("atlas.editor.flipSide")}</button>
          <button type="button" className="mode-actions-btn bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] hover:border-gold-dim" onClick={confirmPreview}>{t("atlas.editor.applyCarve")}</button>
          <button type="button" className="mode-actions-btn bg-none border border-line text-parchment rounded-lg py-1 px-2.5 text-[13px] hover:border-gold-dim" onClick={cancelDraw}>{t("common.cancel")}</button>
        </div>
      ) : null}
      {chooser ? (
        <RegionChooser
          options={chooser.options}
          position={chooser}
          onPick={(id) => {
            selectRegion(id);
            setChooser(null);
          }}
          onClear={() => {
            selectRegion(null);
            setChooser(null);
          }}
          onClose={() => setChooser(null)}
        />
      ) : null}
    </div>
  );
}
