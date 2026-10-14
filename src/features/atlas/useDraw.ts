import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Pt, Region } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import type { TransformApi } from "./stage/useStageTransform";

export const CLOSE_RADIUS_PX = 14;
export const DUPLICATE_RADIUS_PX = 8;

export type AtlasTool = "select" | "pin" | "region";

export interface UseDrawParams {
  atlasId: string;
  /** Ref to the live Stage transform api; materializes inside the Stage
   *  children callback, so event-time reads must go through the ref. */
  transformApi: RefObject<TransformApi | null>;
  tool: AtlasTool;
  onFinish?(region: Region): void;
}

export interface DrawApi {
  drawVertices: Pt[];
  drawCursor: Pt | null;
  drawing: boolean;
  onStageClick(pt: Pt, clientX: number, clientY: number): void;
  onStageMove(pt: Pt, clientX: number, clientY: number): void;
  onStageDblClick(pt: Pt, clientX: number, clientY: number): void;
  finishRegion(): Region | null;
  cancelDraw(): void;
  attemptFinishRegion(): boolean;
}

export function useDraw({ atlasId, transformApi, tool, onFinish }: UseDrawParams): DrawApi {
  const [drawVertices, setDrawVertices] = useState<Pt[]>([]);
  const [drawCursor, setDrawCursor] = useState<Pt | null>(null);
  const verticesRef = useRef<Pt[]>(drawVertices);
  verticesRef.current = drawVertices;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const atlasIdRef = useRef(atlasId);
  atlasIdRef.current = atlasId;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const clear = useCallback(() => {
    setDrawVertices([]);
    setDrawCursor(null);
  }, []);

  const screenDistance = useCallback((a: Pt, b: Pt): number => {
    const api = transformApi.current;
    const pxPerUnit = (api?.imgW ?? 0) * (api?.scale ?? 1);
    return Math.hypot(a.x - b.x, a.y - b.y) * pxPerUnit;
  }, [transformApi]);

  const finishRegion = useCallback((): Region | null => {
    const points = verticesRef.current;
    if (points.length < 3) return null;
    const store = useScriptorium.getState();
    const region = store.addRegion(atlasIdRef.current, { points });
    if (region) {
      onFinishRef.current?.(region);
    } else {
      store.pushToast("error", "Região pequena demais — desenho descartado.");
    }
    clear();
    return region;
  }, [clear]);

  const attemptFinishRegion = useCallback((): boolean => {
    if (verticesRef.current.length < 3) return false;
    return finishRegion() !== null;
  }, [finishRegion]);

  const onStageClick = useCallback(
    (pt: Pt, clientX: number, clientY: number) => {
      void clientX;
      void clientY;
      if (toolRef.current !== "region") return;
      const verts = verticesRef.current;
      if (verts.length === 0) {
        setDrawVertices([{ x: pt.x, y: pt.y }]);
        return;
      }
      if (screenDistance(pt, verts[0]) < CLOSE_RADIUS_PX) {
        if (verts.length >= 3) finishRegion();
        return;
      }
      const last = verts[verts.length - 1];
      if (screenDistance(pt, last) < DUPLICATE_RADIUS_PX) return;
      setDrawVertices([...verts, { x: pt.x, y: pt.y }]);
    },
    [finishRegion, screenDistance],
  );

  const onStageMove = useCallback((pt: Pt, clientX: number, clientY: number) => {
    void clientX;
    void clientY;
    if (toolRef.current !== "region") return;
    setDrawCursor({ x: pt.x, y: pt.y });
  }, []);

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

  useEffect(() => {
    if (tool !== "region") {
      setDrawVertices([]);
      setDrawCursor(null);
    }
  }, [tool]);

  return {
    drawVertices,
    drawCursor,
    drawing: drawVertices.length > 0,
    onStageClick,
    onStageMove,
    onStageDblClick,
    finishRegion,
    cancelDraw: clear,
    attemptFinishRegion,
  };
}