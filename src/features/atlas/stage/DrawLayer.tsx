import type { Pt } from "../../../domain/types";
import type { CarvePreview } from "../useDraw";
import "../atlas.css";

export interface DrawLayerProps {
  drawVertices: Pt[];
  drawCursor: Pt | null;
  imgW: number;
  imgH: number;
  carvePreview?: CarvePreview | null;
  carveSnapPoints?: Pt[];
}

export function DrawLayer({ drawVertices, drawCursor, imgW, imgH, carvePreview, carveSnapPoints }: DrawLayerProps) {
  if (!imgW || !imgH) return null;
  const previewing = !!carvePreview;
  if (!previewing && drawVertices.length === 0) return null;
  const toPx = (p: Pt) => `${p.x * imgW},${p.y * imgH}`;
  const preview = drawCursor ? [...drawVertices, drawCursor] : drawVertices;
  const first = drawVertices[0];
  return (
    <g className="draw-layer">
      {carvePreview ? (
        <polygon
          className="carve-preview"
          points={carvePreview.points.map(toPx).join(" ")}
          vectorEffect="non-scaling-stroke"
        />
      ) : preview.length >= 2 ? (
        <polygon
          className="draw-preview"
          points={preview.map(toPx).join(" ")}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {!previewing && first ? (
        <circle className="draw-first-marker" cx={first.x * imgW} cy={first.y * imgH} r={6} />
      ) : null}
      {(carveSnapPoints ?? []).map((p, i) => (
        <circle key={i} className="carve-snap-marker" cx={p.x * imgW} cy={p.y * imgH} r={6} />
      ))}
    </g>
  );
}