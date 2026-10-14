import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Pt } from "../../../domain/types";

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
export const MOVE_THRESHOLD_PX = 5;
export const WHEEL_FACTOR = 1.1;

export interface TransformApi {
  imgW: number;
  imgH: number;
  scale: number;
  panX: number;
  panY: number;
  zoomAtPoint(clientX: number, clientY: number, nextScale: number): void;
  setPan(clientX: number, clientY: number): void;
  fitToContainer(): void;
  zoomBy(factor: number): void;
  fromClient(clientX: number, clientY: number): Pt | null;
  toClient(pt: Pt): { left: number; top: number };
}

interface ViewState {
  scale: number;
  panX: number;
  panY: number;
}

interface Grab {
  pointerId?: number;
  clientX: number;
  clientY: number;
  panX: number;
  panY: number;
}

interface PinchAnchor {
  midX: number;
  midY: number;
  dist: number;
  scale: number;
  panX: number;
  panY: number;
}

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

// jsdom's MouseEvent fallback for pointer events has no pointerType; real
// browsers always report "mouse"/"touch"/"pen".
const isMousePointer = (e: PointerEvent) => !e.pointerType || e.pointerType === "mouse";

export type StageTransform = TransformApi & {
  dragging: boolean;
  setImageSize(w: number, h: number): void;
};

export function useStageTransform(
  stageRef: RefObject<HTMLDivElement>,
  imgRef: RefObject<HTMLImageElement>,
): StageTransform {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<ViewState>({ scale: 1, panX: 0, panY: 0 });
  const [dragging, setDragging] = useState(false);
  const sizeRef = useRef(size);
  const viewRef = useRef(view);
  const grabRef = useRef<Grab | null>(null);
  const pinchRef = useRef<PinchAnchor | null>(null);

  const applyView = useCallback((next: ViewState) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const setImageSize = useCallback(
    (w: number, h: number) => {
      if (sizeRef.current.w === w && sizeRef.current.h === h) return;
      sizeRef.current = { w, h };
      setSize({ w, h });
      applyView({ scale: 1, panX: 0, panY: 0 });
    },
    [applyView],
  );

  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const stage = stageRef.current;
      const { w, h } = sizeRef.current;
      if (!stage || !w || !h) return;
      const scale = clampScale(nextScale);
      if (scale === viewRef.current.scale) return;
      const rect = stage.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const v = viewRef.current;
      const relX = (sx - v.panX) / (w * v.scale);
      const relY = (sy - v.panY) / (h * v.scale);
      applyView({
        scale,
        panX: sx - relX * w * scale,
        panY: sy - relY * h * scale,
      });
    },
    [applyView, stageRef],
  );

  const setPan = useCallback(
    (clientX: number, clientY: number) => {
      const g = grabRef.current;
      if (!g) return;
      applyView({
        scale: viewRef.current.scale,
        panX: g.panX + (clientX - g.clientX),
        panY: g.panY + (clientY - g.clientY),
      });
    },
    [applyView],
  );

  const fitToContainer = useCallback(() => {
    const stage = stageRef.current;
    const { w, h } = sizeRef.current;
    if (!stage || !w || !h) return;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    if (!cw || !ch) return;
    const scale = clampScale(Math.min(cw / w, ch / h));
    applyView({
      scale,
      panX: (cw - w * scale) / 2,
      panY: (ch - h * scale) / 2,
    });
  }, [applyView, stageRef]);

  const zoomBy = useCallback(
    (factor: number) => {
      const stage = stageRef.current;
      if (!stage || !sizeRef.current.w) return;
      const rect = stage.getBoundingClientRect();
      zoomAtPoint(
        rect.left + stage.clientWidth / 2,
        rect.top + stage.clientHeight / 2,
        viewRef.current.scale * factor,
      );
    },
    [stageRef, zoomAtPoint],
  );

  const fromClient = useCallback(
    (clientX: number, clientY: number): Pt | null => {
      const stage = stageRef.current;
      const { w, h } = sizeRef.current;
      if (!stage || !w || !h) return null;
      const rect = stage.getBoundingClientRect();
      const v = viewRef.current;
      return {
        x: (clientX - rect.left - v.panX) / (w * v.scale),
        y: (clientY - rect.top - v.panY) / (h * v.scale),
      };
    },
    [stageRef],
  );

  const toClient = useCallback((pt: Pt) => {
    const { w, h } = sizeRef.current;
    const v = viewRef.current;
    return {
      left: v.panX + pt.x * w * v.scale,
      top: v.panY + pt.y * h * v.scale,
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const dragTo = (clientX: number, clientY: number) => {
      const g = grabRef.current;
      if (!g) return;
      if (Math.hypot(clientX - g.clientX, clientY - g.clientY) <= MOVE_THRESHOLD_PX) return;
      setDragging(true);
      setPan(clientX, clientY);
    };

    const onWheel = (e: WheelEvent) => {
      if (!sizeRef.current.w) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR;
      zoomAtPoint(e.clientX, e.clientY, viewRef.current.scale * factor);
    };

    const startGrab = (clientX: number, clientY: number, pointerId?: number) => {
      grabRef.current = {
        pointerId,
        clientX,
        clientY,
        panX: viewRef.current.panX,
        panY: viewRef.current.panY,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !isMousePointer(e)) return;
      if (grabRef.current || pinchRef.current) return;
      startGrab(e.clientX, e.clientY, e.pointerId);
      if (typeof stage.setPointerCapture === "function") {
        try {
          stage.setPointerCapture(e.pointerId);
        } catch {
          /* not capturable */
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const g = grabRef.current;
      if (!g || (g.pointerId !== undefined && g.pointerId !== e.pointerId) || !isMousePointer(e)) return;
      dragTo(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      const g = grabRef.current;
      if (!g || (g.pointerId !== undefined && g.pointerId !== e.pointerId) || !isMousePointer(e)) return;
      grabRef.current = null;
      setDragging(false);
      if (typeof stage.hasPointerCapture === "function" && stage.hasPointerCapture(e.pointerId)) {
        try {
          stage.releasePointerCapture(e.pointerId);
        } catch {
          /* not capturable */
        }
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        if (e.touches.length === 1 && !pinchRef.current) {
          startGrab(e.touches[0].clientX, e.touches[0].clientY);
        }
        return;
      }
      grabRef.current = null;
      setDragging(false);
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const rect = stage.getBoundingClientRect();
      const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
      const midY = (t0.clientY + t1.clientY) / 2 - rect.top;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const v = viewRef.current;
      pinchRef.current = { midX, midY, dist, scale: v.scale, panX: v.panX, panY: v.panY };
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      const pinch = pinchRef.current;
      if (pinch && e.touches.length >= 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        if (!dist || !pinch.dist) return;
        const rect = stage.getBoundingClientRect();
        const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
        const midY = (t0.clientY + t1.clientY) / 2 - rect.top;
        const next = clampScale((pinch.scale * dist) / pinch.dist);
        const { w, h } = sizeRef.current;
        const relX = (pinch.midX - pinch.panX) / (w * pinch.scale);
        const relY = (pinch.midY - pinch.panY) / (h * pinch.scale);
        applyView({
          scale: next,
          panX: midX - relX * w * next,
          panY: midY - relY * h * next,
        });
        e.preventDefault();
        return;
      }
      if (!pinch && e.touches.length === 1 && grabRef.current) {
        dragTo(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (pinchRef.current && e.touches.length < 2) {
        pinchRef.current = null;
        if (e.touches.length === 1) {
          const t = e.touches[0];
          startGrab(t.clientX, t.clientY);
        }
      }
      if (!pinchRef.current && e.touches.length === 0 && grabRef.current) {
        grabRef.current = null;
        setDragging(false);
      }
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    stage.addEventListener("touchstart", onTouchStart, { passive: false });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd);
    stage.addEventListener("touchcancel", onTouchEnd);

    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [applyView, setPan, stageRef, zoomAtPoint]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.naturalWidth && img?.naturalHeight) setImageSize(img.naturalWidth, img.naturalHeight);
  }, [imgRef, setImageSize]);

  return useMemo(
    () => ({
      imgW: size.w,
      imgH: size.h,
      scale: view.scale,
      panX: view.panX,
      panY: view.panY,
      zoomAtPoint,
      setPan,
      fitToContainer,
      zoomBy,
      fromClient,
      toClient,
      dragging,
      setImageSize,
    }),
    [dragging, fitToContainer, fromClient, setImageSize, setPan, size, toClient, view, zoomAtPoint, zoomBy],
  );
}