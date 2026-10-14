import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
export const MOVE_THRESHOLD_PX = 5;

export interface ViewState { scale: number; panX: number; panY: number }

interface Grab {
  clientX: number;
  clientY: number;
  panX: number;
  panY: number;
  moved: boolean;
}

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

// jsdom's pointer fallback has no pointerType; real browsers always report one.
const isMousePointer = (e: PointerEvent) => !e.pointerType || e.pointerType === "mouse";

/** Node DOM (persons/houses) owns its own pointer handling — never pan from them. */
const fromNodeDom = (e: { target: EventTarget | null }) => {
  const t = e.target as Element | null;
  return !!(t && typeof t.closest === "function" && t.closest(".bl-node"));
};

export interface PlaneApi {
  scale: number;
  panX: number;
  panY: number;
  planeW: number;
  planeH: number;
  setPlaneSize(w: number, h: number): void;
  zoomAtPoint(clientX: number, clientY: number, nextScale: number): void;
  zoomBy(factor: number): void;
  fitToContainer(): void;
  fromClient(clientX: number, clientY: number): { x: number; y: number } | null;
  centerOn(x: number, y: number): void;
  onPointerDown(e: React.PointerEvent): void;
  onPointerMove(e: React.PointerEvent): void;
  onPointerUp(e: React.PointerEvent): void;
  onTouchStart(e: React.TouchEvent): void;
  onTouchMove(e: React.TouchEvent): void;
  onTouchEnd(e: React.TouchEvent): void;
}

export function usePlane(stageRef: RefObject<HTMLDivElement>): PlaneApi {
  const [size, setSize] = useState({ w: 20000, h: 20000 });
  const [view, setView] = useState<ViewState>({ scale: 0.1, panX: 0, panY: 0 });
  const sizeRef = useRef(size);
  const viewRef = useRef(view);
  const grabRef = useRef<Grab | null>(null);
  const pinchRef = useRef<{ midX: number; midY: number; dist: number; scale: number; panX: number; panY: number } | null>(null);

  const applyView = useCallback((next: ViewState) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const fitToContainer = useCallback(() => {
    const stage = stageRef.current;
    const { w, h } = sizeRef.current;
    if (!stage || !w || !h) return;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    if (!cw || !ch) return;
    // 2.5x: the plane is a 20k canvas — fit shrinks to unreadable; start at
    // a readable fraction of the fit.
    const scale = clampScale(Math.min(cw / w, ch / h) * 2.5);
    applyView({
      scale,
      panX: (cw - w * scale) / 2,
      panY: (ch - h * scale) / 2,
    });
  }, [applyView, stageRef]);

  const setPlaneSize = useCallback((w: number, h: number) => {
    if (sizeRef.current.w === w && sizeRef.current.h === h) return;
    sizeRef.current = { w, h };
    setSize({ w, h });
  }, []);

  const zoomAtPoint = useCallback((clientX: number, clientY: number, nextScale: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const scale = clampScale(nextScale);
    if (scale === viewRef.current.scale) return;
    const rect = stage.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const v = viewRef.current;
    const relX = (sx - v.panX) / v.scale;
    const relY = (sy - v.panY) / v.scale;
    applyView({
      scale,
      panX: sx - relX * scale,
      panY: sy - relY * scale,
    });
  }, [applyView, stageRef]);

  const zoomBy = useCallback((factor: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    zoomAtPoint(rect.left + stage.clientWidth / 2, rect.top + stage.clientHeight / 2, viewRef.current.scale * factor);
  }, [stageRef, zoomAtPoint]);

  const centerOn = useCallback((x: number, y: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const cw = stage.clientWidth;
    const ch = stage.clientHeight;
    if (!cw || !ch) return;
    applyView({
      scale: viewRef.current.scale,
      panX: cw / 2 - x * viewRef.current.scale,
      panY: ch / 2 - y * viewRef.current.scale,
    });
  }, [applyView, stageRef]);

  const fromClient = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: (clientX - rect.left - v.panX) / v.scale,
      y: (clientY - rect.top - v.panY) / v.scale,
    };
  }, [stageRef]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isMousePointer(e.nativeEvent)) return;
    if (e.button !== 0) return;
    if (fromNodeDom(e)) return;
    grabRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: viewRef.current.panX,
      panY: viewRef.current.panY,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const g = grabRef.current;
    if (!g) return;
    const dx = e.clientX - g.clientX;
    const dy = e.clientY - g.clientY;
    if (!g.moved && Math.hypot(dx, dy) <= MOVE_THRESHOLD_PX) return;
    g.moved = true;
    applyView({ ...viewRef.current, panX: g.panX + dx, panY: g.panY + dy });
  }, [applyView]);

  const onPointerUp = useCallback(() => {
    grabRef.current = null;
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    zoomAtPoint(e.clientX, e.clientY, viewRef.current.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, [zoomAtPoint]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [stageRef, onWheel]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    pinchRef.current = {
      midX: (a.clientX + b.clientX) / 2,
      midY: (a.clientY + b.clientY) / 2,
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      scale: viewRef.current.scale,
      panX: viewRef.current.panX,
      panY: viewRef.current.panY,
    };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const p = pinchRef.current;
    if (!p || e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const midX = (a.clientX + b.clientX) / 2;
    const midY = (a.clientY + b.clientY) / 2;
    const scale = clampScale(p.scale * (dist / p.dist));
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (p.midX - rect.left - p.panX) / p.scale;
    const relY = (p.midY - rect.top - p.panY) / p.scale;
    applyView({
      scale,
      panX: midX - rect.left - relX * scale,
      panY: midY - rect.top - relY * scale,
    });
  }, [applyView, stageRef]);

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null;
  }, []);

  return {
    scale: view.scale,
    panX: view.panX,
    panY: view.panY,
    planeW: size.w,
    planeH: size.h,
    setPlaneSize,
    zoomAtPoint,
    zoomBy,
    fitToContainer,
    fromClient,
    centerOn,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
