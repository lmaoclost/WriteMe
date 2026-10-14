import { useState } from "react";
import type { Id, Region } from "../../../domain/types";
import { polygonArea, regionCentroid } from "../../../domain/geometry";
import type { TransformApi } from "./useStageTransform";
import "../atlas.css";

export interface RegionLayerProps {
  regions: Region[];
  transformApi: TransformApi;
  selectedRegionId: Id | null;
  onSelectRegion(regionId: Id): void;
  interactive: boolean;
  carveParentId?: Id | null;
}

const roundOpacity = (v: number) => Math.round(v * 1000) / 1000;

export function RegionLayer({
  regions,
  transformApi,
  selectedRegionId,
  onSelectRegion,
  interactive,
  carveParentId,
}: RegionLayerProps) {
  const [hoveredId, setHoveredId] = useState<Id | null>(null);
  const { imgW, imgH } = transformApi;
  if (!imgW || !imgH) return null;

  const sorted = [...regions].sort((a, b) => polygonArea(b.points) - polygonArea(a.points));
  return (
    <g className="region-layer">
      {sorted.map((region) => {
        const selected = region.id === selectedRegionId;
        const hovered = region.id === hoveredId;
        const base = region.fillOpacity ?? 0.28;
        const fillOpacity = selected
          ? roundOpacity(Math.min(0.6, base + 0.15))
          : hovered
            ? roundOpacity(Math.min(0.62, base + 0.02))
            : roundOpacity(base);
        const centroid = regionCentroid(region.points);
        const className =
          "region-poly" +
          (selected ? " selected" : "") +
          (hovered ? " hovered" : "") +
          (region.id === carveParentId ? " carve-parent" : "");
        return (
          <g key={region.id}>
            <polygon
              className={className}
              points={region.points.map((p) => `${p.x * imgW},${p.y * imgH}`).join(" ")}
              fill={region.color}
              fillOpacity={fillOpacity}
              stroke={region.color}
              pointerEvents={interactive ? "auto" : "none"}
              vectorEffect="non-scaling-stroke"
              onPointerDown={() => onSelectRegion(region.id)}
              onPointerEnter={() => setHoveredId(region.id)}
              onPointerLeave={() => setHoveredId(null)}
            />
            <text
              className="region-label"
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
      })}
    </g>
  );
}
