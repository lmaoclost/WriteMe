import { useEffect, useRef, useState } from "react";
import type { Id, Pt, Region } from "../../domain/types";
import { pointInPolygon, polygonArea } from "../../domain/geometry";
import { useScriptorium } from "../../data/store";
import { Stage } from "./stage/Stage";
import type { TransformApi } from "./stage/useStageTransform";
import { RegionLayer } from "./stage/RegionLayer";
import { DrawLayer } from "./stage/DrawLayer";
import { useDraw, type AtlasTool } from "./useDraw";
import "./atlas.css";

export interface AtlasEditorProps {
  atlasId: string;
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
      <div className="chooser-backdrop" onPointerDown={onClose} aria-hidden="true" />
      <div
        className="region-chooser"
        role="dialog"
        aria-label="Escolher região"
        style={{ left: position.x, top: position.y }}
      >
        {options.map((r) => (
          <button type="button" key={r.id} onClick={() => onPick(r.id)}>
            {r.label || "Região"}
          </button>
        ))}
        <button type="button" onClick={onClear}>Nenhuma</button>
      </div>
    </>
  );
}

export function AtlasEditor({ atlasId }: AtlasEditorProps) {
  const atlas = useScriptorium((s) => s.atlases.find((a) => a.id === atlasId));
  const [tool, setTool] = useState<AtlasTool>("select");
  const [selectedRegionId, setSelectedRegionId] = useState<Id | null>(null);
  const [chooser, setChooser] = useState<ChooserState | null>(null);
  const apiRef = useRef<TransformApi | null>(null);
  const draw = useDraw({
    atlasId,
    transformApi: apiRef,
    tool,
    onFinish: (region) => setSelectedRegionId(region.id),
  });
  const { drawing, cancelDraw, attemptFinishRegion } = draw;

  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDraw();
      else if (e.key === "Enter") attemptFinishRegion();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawing, cancelDraw, attemptFinishRegion]);

  if (!atlas) return null;

  const handleStageClick = (pt: Pt, clientX: number, clientY: number) => {
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

  const tools: Array<{ name: string; label: string; value: AtlasTool }> = [
    { name: "Ferramenta mover", label: "Mover", value: "select" },
    { name: "Ferramenta pino", label: "Pino", value: "pin" },
    { name: "Ferramenta região", label: "Região", value: "region" },
  ];

  return (
    <div className="atlas-editor" data-tool={tool}>
      <div className="editor-toolbar">
        {tools.map((t) => (
          <button
            type="button"
            key={t.value}
            aria-label={t.name}
            aria-pressed={tool === t.value}
            onClick={() => setTool(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Stage atlas={atlas} onStageClick={handleStageClick} onStageMove={handleStageMove} onStageDblClick={handleStageDblClick}>
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
              />
              <DrawLayer
                drawVertices={draw.drawVertices}
                drawCursor={draw.drawCursor}
                imgW={api.imgW}
                imgH={api.imgH}
              />
            </>
          );
        }}
      </Stage>
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