import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Id, Pt, Region } from "../../domain/types";
import {
  polygonArea,
  pointInPolygon,
  projectToBoundary,
  snapToCarveBorder,
} from "../../domain/geometry";
import { buildCarveChild, detectCarveParent, regionNearestToPoint } from "../../domain/carve";
import { useScriptorium } from "../../data/store";
import { useRafState } from "../../ui/useRaf";
import type { TransformApi } from "./stage/useStageTransform";

export const CLOSE_RADIUS_PX = 14;
export const DUPLICATE_RADIUS_PX = 8;
export const CARVE_VERTEX_PX = 14;
export const CARVE_EDGE_PX = 8;

export type AtlasTool = "select" | "pin" | "region";
export type DrawMode = "none" | "carve" | "neighbor" | "fit";

/** projectToBoundary result kept as the entry/exit reference. */
export interface CarveRef {
  point: Pt;
  edgeIndex: number;
  t: number;
}

export interface CarvePreview {
  forward: Pt[];
  backward: Pt[];
  /** Path used for the commit: forward when useForward, backward otherwise. */
  points: Pt[];
  /** Whether the middle of the user path lies inside the parent (trim signal). */
  inside: boolean;
  /** area(forward) <= area(backward) picks forward (smaller side) initially. */
  useForward: boolean;
}

export interface UseDrawParams {
  atlasId: string;
  /** Ref to the live Stage transform api; materializes inside the Stage
   *  children callback, so event-time reads must go through the ref. */
  transformApi: RefObject<TransformApi | null>;
  tool: AtlasTool;
  mode: DrawMode;
  onFinish?(region: Region): void;
}

export interface DrawApi {
  drawVertices: Pt[];
  drawCursor: Pt | null;
  drawing: boolean;
  carveParentId: Id | null;
  carvePreview: CarvePreview | null;
  carveSnapPoints: Pt[];
  onStageClick(pt: Pt, clientX: number, clientY: number): void;
  onStageMove(pt: Pt, clientX: number, clientY: number): void;
  onStageDblClick(pt: Pt, clientX: number, clientY: number): void;
  finishRegion(): Region | null;
  attemptFinishRegion(): boolean;
  confirmCarve(): Region | null;
  flipCarvePreview(): void;
  cancelDraw(): void;
}

export function useDraw({ atlasId, transformApi, tool, mode, onFinish }: UseDrawParams): DrawApi {
  const [drawVertices, setDrawVertices] = useState<Pt[]>([]);
  // cursor/snap follow the pointer: commits coalesced to frame rate
  const [drawCursor, scheduleCursor] = useRafState<Pt | null>(null);
  const [carveParentId, setCarveParentId] = useState<Id | null>(null);
  const [carvePreview, setCarvePreview] = useState<CarvePreview | null>(null);
  const [snapHint, scheduleSnapHint] = useRafState<Pt | null>(null);
  const verticesRef = useRef<Pt[]>(drawVertices);
  verticesRef.current = drawVertices;
  const previewRef = useRef<CarvePreview | null>(carvePreview);
  previewRef.current = carvePreview;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const atlasIdRef = useRef(atlasId);
  atlasIdRef.current = atlasId;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const parentRef = useRef<Id | null>(null);
  const entryRef = useRef<CarveRef | null>(null);
  const exitRef = useRef<CarveRef | null>(null);
  const middleRef = useRef<Pt[]>([]);

  const pxPerUnit = useCallback((): number => {
    const api = transformApi.current;
    return api ? api.imgW * api.scale : 0;
  }, [transformApi]);

  const regionsNow = useCallback((): Array<{ id: Id; points: Pt[] }> => {
    return (
      useScriptorium.getState().atlases.find((a) => a.id === atlasIdRef.current)?.regions ?? []
    );
  }, []);

  const parentNow = useCallback((parentId: Id): { pts: Pt[] } | null => {
    const pts = regionsNow().find((r) => r.id === parentId)?.points;
    return pts ? { pts } : null;
  }, [regionsNow]);

  const resetCarve = useCallback(() => {
    parentRef.current = null;
    entryRef.current = null;
    exitRef.current = null;
    middleRef.current = [];
    setCarveParentId(null);
    setCarvePreview(null);
  }, []);

  const clear = useCallback(() => {
    setDrawVertices([]);
    scheduleCursor((prev) => (prev === null ? prev : null));
    scheduleSnapHint((prev) => (prev === null ? prev : null));
    resetCarve();
  }, [resetCarve]);

  /** Recomputes the carve preview; the smaller side wins until flipped. */
  const recomputeCarvePreview = useCallback(() => {
    const entry = entryRef.current;
    const exit = exitRef.current;
    const parentId = parentRef.current;
    if (!entry || !exit || !parentId) {
      setCarvePreview(null);
      return;
    }
    const parent = parentNow(parentId);
    if (!parent) {
      setCarvePreview(null);
      return;
    }
    const middle = middleRef.current;
    const forward = buildCarveChild(parent.pts, entry, exit, true, middle);
    const backward = buildCarveChild(parent.pts, entry, exit, false, middle);
    const useForward = polygonArea(forward) <= polygonArea(backward);
    const sum = middle.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    const mid = middle.length > 0
      ? { x: sum.x / middle.length, y: sum.y / middle.length }
      : entry.point;
    setCarvePreview({
      forward,
      backward,
      points: useForward ? forward : backward,
      inside: pointInPolygon(mid, parent.pts),
      useForward,
    });
  }, [parentNow]);

  const flipCarvePreview = useCallback(() => {
    setCarvePreview((p) =>
      p
        ? {
            ...p,
            useForward: !p.useForward,
            points: p.useForward ? p.backward : p.forward,
          }
        : p,
    );
  }, []);

  /** legacy confirmCarve: child committed, parent trimmed to the opposite walk
   *  when the user path lies inside it (never trims in neighbor mode). */
  const confirmCarve = useCallback((): Region | null => {
    const preview = previewRef.current;
    const parentId = parentRef.current;
    const isNeighbor = modeRef.current === "neighbor";
    if (!preview || !parentId) return null;
    const store = useScriptorium.getState();
    if (preview.points.length < 3) {
      clear();
      store.pushToast("error", "Move the endpoints to the parent region's edge.");
      return null;
    }
    const region = store.addRegion(atlasIdRef.current, { points: preview.points });
    if (!region) {
      clear();
      store.pushToast("error", "Region too small — drawing discarded.");
      return null;
    }
    const opposite = preview.useForward ? preview.backward : preview.forward;
    if (!isNeighbor && preview.inside) {
      if (opposite.length < 3) {
        store.pushToast("error", "Move the endpoints to the parent region's edge.");
      } else {
        store.updateRegion(parentId, { points: opposite });
      }
    }
    store.pushToast("success", isNeighbor ? "Neighbor region carved — name it." : "Region carved — name it.");
    onFinishRef.current?.(region);
    clear();
    return region;
  }, [clear]);

  const finishRegion = useCallback((): Region | null => {
    const points = verticesRef.current;
    if (points.length < 3) return null;
    const store = useScriptorium.getState();
    const region = store.addRegion(atlasIdRef.current, { points });
    if (region) {
      onFinishRef.current?.(region);
    } else {
      store.pushToast("error", "Region too small — drawing discarded.");
    }
    clear();
    return region;
  }, [clear]);

  /** Fit mode confirms through the store clip op: the biggest uncovered piece
   *  of the drawing becomes the region; a fully covered drawing adds none. */
  const commitFit = useCallback((): boolean => {
    const points = verticesRef.current;
    if (points.length < 3) return false;
    const store = useScriptorium.getState();
    const region = store.fitRegionIntoGap(atlasIdRef.current, points);
    clear();
    if (region) {
      store.pushToast("success", "Region fitted — name it.");
      onFinishRef.current?.(region);
      return true;
    }
    store.pushToast("error", "No area left to fit.");
    return false;
  }, [clear]);

  const attemptFinishRegion = useCallback((): boolean => {
    const current = modeRef.current;
    if (current === "carve" || current === "neighbor") {
      if (previewRef.current) {
        return confirmCarve() !== null;
      }
      // No border parent: legacy falls back to free drawing → normal finish.
      if (!entryRef.current) return finishRegion() !== null;
      // Armed entry without a snapped exit must not be a silent dead end (S2):
      // legacy §7 toast fires and the carve stays armed for a better exit click.
      useScriptorium.getState().pushToast("error", "Move the endpoints to the parent region's edge.");
      return false;
    }
    if (current === "fit") return commitFit();
    return finishRegion() !== null;
  }, [commitFit, confirmCarve, finishRegion]);

  /** First click: carve snaps against all regions and detects the containing
   *  parent; neighbor shares the border of the nearest region. No snap → free
   *  drawing fallback (no preview, no parent). */
  const onStageClick = useCallback(
    (pt: Pt, clientX: number, clientY: number) => {
      void clientX;
      void clientY;
      if (toolRef.current !== "region") return;
      const px = pxPerUnit();
      const current = modeRef.current;
      const carving = current === "carve" || current === "neighbor";

      if (carving && entryRef.current) {
        const parentId = parentRef.current;
        const parent = parentId ? parentNow(parentId) : null;
        if (parent) {
          const verts = verticesRef.current;
          const last = verts[verts.length - 1];
          if (last && Math.hypot(pt.x - last.x, pt.y - last.y) * px < DUPLICATE_RADIUS_PX) return;
          const snap = px
            ? snapToCarveBorder(pt, [{ id: parentId!, points: parent.pts }], px, {
                vertexPx: CARVE_VERTEX_PX,
                edgePx: CARVE_EDGE_PX,
              })
            : null;
          const exitExisted = exitRef.current !== null;
          if (snap) {
            const proj = projectToBoundary(snap.point, parent.pts);
            exitRef.current = { point: proj.point, edgeIndex: proj.edgeIndex, t: proj.t };
            setDrawVertices([entryRef.current!.point, ...middleRef.current, proj.point]);
            recomputeCarvePreview();
            return;
          }
          // Un-snapped click: an intermediate (middle) vertex of the user path.
          middleRef.current = [...middleRef.current, { x: pt.x, y: pt.y }];
          setDrawVertices([
            entryRef.current!.point,
            ...middleRef.current,
            ...(exitExisted ? [exitRef.current!.point] : []),
          ]);
          if (exitExisted) recomputeCarvePreview();
          return;
        }
      }

      const verts = verticesRef.current;
      if (verts.length === 0) {
        if (carving && px) {
          const regions = regionsNow();
          if (current === "carve") {
            const snap = snapToCarveBorder(pt, regions, px, {
              vertexPx: CARVE_VERTEX_PX,
              edgePx: CARVE_EDGE_PX,
            });
            if (snap) {
              const parentId = detectCarveParent(snap.point, regions);
              if (parentId) {
                const parent = parentNow(parentId);
                if (parent) {
                  const proj = projectToBoundary(snap.point, parent.pts);
                  parentRef.current = parentId;
                  entryRef.current = { point: snap.point, edgeIndex: proj.edgeIndex, t: proj.t };
                  exitRef.current = null;
                  middleRef.current = [];
                  setCarveParentId(parentId);
                  setCarvePreview(null);
                  setDrawVertices([{ x: snap.point.x, y: snap.point.y }]);
                  return;
                }
              }
            }
          } else {
            const parentId = regionNearestToPoint(pt, regions);
            if (parentId) {
              const parent = parentNow(parentId);
              if (parent) {
                const proj = projectToBoundary(pt, parent.pts);
                parentRef.current = parentId;
                entryRef.current = { point: proj.point, edgeIndex: proj.edgeIndex, t: proj.t };
                exitRef.current = null;
                middleRef.current = [];
                setCarveParentId(parentId);
                setCarvePreview(null);
                setDrawVertices([{ x: proj.point.x, y: proj.point.y }]);
                return;
              }
            }
          }
        }
        setDrawVertices([{ x: pt.x, y: pt.y }]);
        return;
      }
      if (px && Math.hypot(pt.x - verts[0].x, pt.y - verts[0].y) * px < CLOSE_RADIUS_PX) {
        if (verts.length >= 3) attemptFinishRegion();
        return;
      }
      const last = verts[verts.length - 1];
      if (px && Math.hypot(pt.x - last.x, pt.y - last.y) * px < DUPLICATE_RADIUS_PX) return;
      setDrawVertices([...verts, { x: pt.x, y: pt.y }]);
    },
    [attemptFinishRegion, parentNow, pxPerUnit, regionsNow, recomputeCarvePreview],
  );

  const onStageMove = useCallback(
    (pt: Pt, clientX: number, clientY: number) => {
      void clientX;
      void clientY;
      if (toolRef.current !== "region") return;
      const cursor = { x: pt.x, y: pt.y };
      scheduleCursor((prev) => (prev && prev.x === cursor.x && prev.y === cursor.y ? prev : cursor));
      const current = modeRef.current;
      const carving = current === "carve" || current === "neighbor";
      const parentId = carving && entryRef.current ? parentRef.current : null;
      const parent = parentId ? parentNow(parentId) : null;
      const px = pxPerUnit();
      const snap =
        px && parent
          ? snapToCarveBorder(pt, [{ id: parentId!, points: parent.pts }], px, {
              vertexPx: CARVE_VERTEX_PX,
              edgePx: CARVE_EDGE_PX,
            })
          : null;
      const hint = snap ? snap.point : null;
      scheduleSnapHint((prev) => {
        if (prev === null && hint === null) return prev;
        if (prev && hint && prev.x === hint.x && prev.y === hint.y) return prev;
        return hint;
      });
    },
    [parentNow, pxPerUnit],
  );

  const onStageDblClick = useCallback(
    (pt: Pt, clientX: number, clientY: number) => {
      void pt;
      void clientX;
      void clientY;
      if (toolRef.current !== "region") return;
      attemptFinishRegion();
    },
    [attemptFinishRegion],
  );

  /** Any mode or tool change resets the whole draw/carve machine — a mid-draw
   *  switch away from carve must not leave a stale preview for the next mode. */
  useEffect(() => {
    clear();
  }, [clear, mode, tool]);

  const carveSnapPoints: Pt[] = [];
  if (entryRef.current) carveSnapPoints.push(entryRef.current.point);
  if (exitRef.current) carveSnapPoints.push(exitRef.current.point);
  if (snapHint) carveSnapPoints.push(snapHint);

  return {
    drawVertices,
    drawCursor,
    drawing: drawVertices.length > 0,
    carveParentId,
    carvePreview,
    carveSnapPoints,
    onStageClick,
    onStageMove,
    onStageDblClick,
    finishRegion,
    attemptFinishRegion,
    confirmCarve,
    flipCarvePreview,
    cancelDraw: clear,
  };
}
