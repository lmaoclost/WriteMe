import type { Pt } from "../../../domain/types";
import "../atlas.css";

export interface DrawLayerProps {
  drawVertices: Pt[];
  drawCursor: Pt | null;
  imgW: number;
  imgH: number;
}

export function DrawLayer({ drawVertices, drawCursor, imgW, imgH }: DrawLayerProps) {
  if (!imgW || !imgH || drawVertices.length === 0) return null;
  const toPx = (p: Pt) => `${p.x * imgW},${p.y * imgH}`;
  const preview = drawCursor ? [...drawVertices, drawCursor] : drawVertices;
  const first = drawVertices[0];
  return (
    <g className="draw-layer">
      {preview.length >= 2 ? (
        <polygon
          className="draw-preview"
          points={preview.map(toPx).join(" ")}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <circle className="draw-first-marker" cx={first.x * imgW} cy={first.y * imgH} r={6} />
    </g>
  );
}