import { useEffect, useRef, type ReactNode } from "react";
import type { Atlas, Pt } from "../../../domain/types";
import { useWriteme } from "../../../data/store";
import { MOVE_THRESHOLD_PX, useStageTransform, type StageTransform, type TransformApi } from "./useStageTransform";

export interface StageProps {
  atlas: Atlas;
  onStageClick?(pt: Pt, clientX: number, clientY: number): void;
  onStageMove?(pt: Pt, clientX: number, clientY: number): void;
  onStageDblClick?(pt: Pt, clientX: number, clientY: number): void;
  /** Called whenever the view (scale/pan/size) changes — lets the header show
   *  the zoom percentage. Re-entrancy-safe: same-scale updates are cheap. */
  onTransformChange?(t: StageTransform): void;
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
  onTransformChange,
  overlayChildren,
  children,
}: StageProps) {
  const mapImage = useWriteme((s) => (atlas.mapImageKey ? s.images[atlas.mapImageKey] : undefined));
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const transform = useStageTransform(stageRef, imgRef);
  const { setImageSize } = transform;
  const clickAnchor = useRef<{ clientX: number; clientY: number } | null>(null);

  const notifyTransformRef = useRef(onTransformChange);
  notifyTransformRef.current = onTransformChange;
  const lastPctRef = useRef<number | null>(null);
  useEffect(() => {
    // pan drifts panX/panY continuously; the consumer only reacts to scale,
    // so skip notifications until the zoom percentage actually changes
    const pct = Math.round(transform.scale * 100);
    if (lastPctRef.current === pct) return;
    lastPctRef.current = pct;
    notifyTransformRef.current?.(transform);
  }, [transform]);

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
      className={"stage relative overflow-hidden flex-1 bg-ink cursor-grab" + (transform.dragging ? " dragging cursor-grabbing" : "")}
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
        className="stage-content absolute [transform-origin:0_0]"
        style={{ transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.scale})` }}
      >
        {mapImage ? (
          <img
            ref={imgRef}
            className="stage-map block select-none [-webkit-user-drag:none]"
            src={mapImage}
            alt=""
            draggable={false}
            onLoad={onImageLoad}
          />
        ) : null}
        <svg
          className="stage-overlay absolute inset-0 overflow-visible"
          viewBox={mapImage ? `0 0 ${transform.imgW} ${transform.imgH}` : "0 0 1 1"}
          preserveAspectRatio="none"
        >
          {children(transform)}
        </svg>
        {overlayChildren ? (
          <div
            className="stage-overlay-dom absolute inset-0 [transform-origin:0_0] overflow-visible pointer-events-none"
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
