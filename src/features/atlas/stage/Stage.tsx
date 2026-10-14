import { useEffect, useRef, type ReactNode } from "react";
import type { Atlas, Pt } from "../../../domain/types";
import { useScriptorium } from "../../../data/store";
import { MOVE_THRESHOLD_PX, useStageTransform, type TransformApi } from "./useStageTransform";
import "../atlas.css";

export interface StageProps {
  atlas: Atlas;
  onStageClick?(pt: Pt, clientX: number, clientY: number): void;
  onStageMove?(pt: Pt, clientX: number, clientY: number): void;
  onStageDblClick?(pt: Pt, clientX: number, clientY: number): void;
  /** DOM overlays (pin layer, tooltips) rendered AFTER the svg inside the
   *  transform wrapper; the layer is counter-transformed so children position
   *  in stage coordinates. */
  overlayChildren?: (api: TransformApi) => ReactNode;
  children: (api: TransformApi) => ReactNode;
}

export function Stage({
  atlas,
  onStageClick,
  onStageMove,
  onStageDblClick,
  overlayChildren,
  children,
}: StageProps) {
  const mapImage = useScriptorium((s) => (atlas.mapImageKey ? s.images[atlas.mapImageKey] : undefined));
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const transform = useStageTransform(stageRef, imgRef);
  const { setImageSize } = transform;
  const clickAnchor = useRef<{ clientX: number; clientY: number } | null>(null);

  useEffect(() => {
    if (!mapImage) {
      setImageSize(0, 0);
      return;
    }
    const img = imgRef.current;
    if (img?.naturalWidth && img?.naturalHeight) setImageSize(img.naturalWidth, img.naturalHeight);
  }, [mapImage, setImageSize]);

  const onImageLoad = () => {
    const img = imgRef.current;
    if (img?.naturalWidth && img?.naturalHeight) setImageSize(img.naturalWidth, img.naturalHeight);
  };

  return (
    <div
      ref={stageRef}
      data-testid="stage"
      className={"stage" + (transform.dragging ? " dragging" : "")}
      onPointerDown={(e) => {
        if (e.button === 0) clickAnchor.current = { clientX: e.clientX, clientY: e.clientY };
      }}
      onPointerUp={(e) => {
        const anchor = clickAnchor.current;
        clickAnchor.current = null;
        if (!anchor || e.button !== 0) return;
        if (Math.hypot(e.clientX - anchor.clientX, e.clientY - anchor.clientY) > MOVE_THRESHOLD_PX) return;
        if (!onStageClick) return;
        const pt = transform.fromClient(e.clientX, e.clientY);
        if (pt) onStageClick(pt, e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!onStageMove) return;
        const pt = transform.fromClient(e.clientX, e.clientY);
        if (pt) onStageMove(pt, e.clientX, e.clientY);
      }}
      onDoubleClick={(e) => {
        if (!onStageDblClick) return;
        const pt = transform.fromClient(e.clientX, e.clientY);
        if (pt) onStageDblClick(pt, e.clientX, e.clientY);
      }}
    >
      <div
        className="stage-content"
        style={{ transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.scale})` }}
      >
        {mapImage ? (
          <img
            ref={imgRef}
            className="stage-map"
            src={mapImage}
            alt=""
            draggable={false}
            onLoad={onImageLoad}
          />
        ) : null}
        <svg
          className="stage-overlay"
          viewBox={mapImage ? `0 0 ${transform.imgW} ${transform.imgH}` : "0 0 1 1"}
          preserveAspectRatio="none"
        >
          {children(transform)}
        </svg>
        {overlayChildren ? (
          <div
            className="stage-overlay-dom"
            style={{
              // Exact inverse of the wrapper matrix T(pan)·S(s): function lists
              // compose right-to-left on the point, so scale(1/s) must sit
              // FIRST in the string or the layer drifts by (1−s)·pan.
              transform: `scale(${transform.scale ? 1 / transform.scale : 1}) translate(${-transform.panX}px, ${-transform.panY}px)`,
            }}
          >
            {overlayChildren(transform)}
          </div>
        ) : null}
      </div>
    </div>
  );
}