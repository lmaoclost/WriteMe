import { memo, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Id, Region } from "../../../domain/types";
import { polygonArea, regionCentroid } from "../../../domain/geometry";
import type { TransformApi } from "./useStageTransform";

export interface RegionLayerProps {
  regions: Region[];
  transformApi: TransformApi;
  selectedRegionId: Id | null;
  onSelectRegion(regionId: Id): void;
  onHoverRegion?(regionId: Id | null, at?: { left: number; top: number }): void;
  interactive: boolean;
  carveParentId?: Id | null;
}

const roundOpacity = (v: number) => Math.round(v * 1000) / 1000;
const round2 = (v: number) => Math.round(v * 100) / 100;

const RegionRow = memo(function RegionRow({ region, imgW, imgH, selected, hovered, carveParent, interactive, onSelectRegion, onHover }: {
  region: Region;
  imgW: number;
  imgH: number;
  selected: boolean;
  hovered: boolean;
  carveParent: boolean;
  interactive: boolean;
  onSelectRegion(regionId: Id): void;
  onHover(id: Id | null, centroid?: { x: number; y: number }): void;
}) {
  const base = region.fillOpacity ?? 0.28;
  const fillOpacity = selected
    ? roundOpacity(Math.min(0.6, base + 0.15))
    : hovered
      ? roundOpacity(Math.min(0.62, base + 0.02))
      : roundOpacity(base);
  const centroid = regionCentroid(region.points);
  const className =
    "region-poly [stroke-width:2]" +
    (selected || hovered ? " [stroke-width:3]" : "") +
    (carveParent ? " carve-parent [stroke:var(--gold-dim)] [stroke-opacity:0.9] [stroke-width:3]" : "");
  return (
    <g>
      <polygon
        className={className}
        points={region.points.map((p) => `${round2(p.x * imgW)},${round2(p.y * imgH)}`).join(" ")}
        fill={region.color}
        fillOpacity={fillOpacity}
        stroke={region.color}
        pointerEvents={interactive ? "auto" : "none"}
        vectorEffect="non-scaling-stroke"
        onPointerDown={() => onSelectRegion(region.id)}
        onPointerEnter={() => onHover(region.id, centroid)}
        onPointerLeave={(e: ReactPointerEvent<SVGPolygonElement>) => {
          // moving onto the hover preview keeps it open
          const to = e.relatedTarget instanceof Element ? e.relatedTarget : null;
          if (to?.closest?.(".pin-preview-pop")) return;
          onHover(null);
        }}
      />
      <text
        className="region-label font-mono text-xs"
        x={centroid.x * imgW}
        y={centroid.y * imgH}
        fontSize={12}
        fill="var(--parchment-dim)"
        pointerEvents="none"
        textAnchor="middle"
      >
        {region.label}
      </text>
    </g>
  );
});

export function RegionLayer({
  regions,
  transformApi,
  selectedRegionId,
  onSelectRegion,
  onHoverRegion,
  interactive,
  carveParentId,
}: RegionLayerProps) {
  const [hoveredId, setHoveredId] = useState<Id | null>(null);
  const { imgW, imgH } = transformApi;

  const handleHover = (id: Id | null, centroid?: { x: number; y: number }) => {
    setHoveredId(id);
    if (!onHoverRegion) return;
    if (!id || !centroid) {
      onHoverRegion(id);
      return;
    }
    const at = transformApi.toClient(centroid);
    onHoverRegion(id, { left: at.left, top: at.top });
  };

  // paint order: bigger area first. decorate-sort-undecorate so the O(m·log m)
  // comparisons reuse one computed area instead of rescanning both polygons.
  const sorted = useMemo(() => {
    if (!imgW || !imgH) return [];
    const decorated = regions.map((r) => ({ r, area: polygonArea(r.points) }));
    decorated.sort((a, b) => b.area - a.area);
    return decorated.map((d) => d.r);
  }, [regions, imgW, imgH]);

  return (
    <g className="region-layer">
      {sorted.map((region) => (
        <RegionRow
          key={region.id}
          region={region}
          imgW={imgW}
          imgH={imgH}
          selected={region.id === selectedRegionId}
          hovered={region.id === hoveredId}
          carveParent={region.id === carveParentId}
          interactive={interactive}
          onSelectRegion={onSelectRegion}
          onHover={handleHover}
        />
      ))}
    </g>
  );
}
