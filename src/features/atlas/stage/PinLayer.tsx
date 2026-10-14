import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type CSSProperties } from "react";
import type { Id, Pin } from "../../../domain/types";
import { useScriptorium } from "../../../data/store";
import type { TransformApi } from "./useStageTransform";
import { PIN_TYPE_META } from "../panels/pinTypes";
import "../atlas.css";

export const PIN_SIZE_PX = 18;
export const PIN_HALF_PX = PIN_SIZE_PX / 2;
const MOVE_THRESHOLD = 5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface PinLayerProps {
  atlasId: Id;
  pins: Pin[];
  transformApi: TransformApi;
  /** Pins are click-through while the region tool draws over them. */
  interactive: boolean;
  selectedPinId: Id | null;
  onSelectPin(pinId: Id): void;
  onHoverEnter(
    pinId: Id,
    cursor: { x: number; y: number },
    stage: { w: number; h: number },
  ): void;
  onHoverLeave(): void;
}

export interface PinHoverState {
  pinId: Id;
  cursor: { x: number; y: number };
  stage: { w: number; h: number };
}

/** Stage-space pin position (legacy pinStyle): the DOM layer renders inside the
 *  transform wrapper with a counter-transform, so panX/imgW/scale here make
 *  the offsets exactly the on-screen stage coordinates. */
export function pinStyle(pin: Pin, transformApi: TransformApi): CSSProperties {
  return {
    left: transformApi.panX + pin.x * transformApi.imgW * transformApi.scale - PIN_HALF_PX,
    top: transformApi.panY + pin.y * transformApi.imgH * transformApi.scale - PIN_HALF_PX,
  };
}

export function PinLayer({
  atlasId,
  pins,
  transformApi,
  interactive,
  selectedPinId,
  onSelectPin,
  onHoverEnter,
  onHoverLeave,
}: PinLayerProps) {
  const apiRef = useRef(transformApi);
  apiRef.current = transformApi;
  const atlasIdRef = useRef(atlasId);
  atlasIdRef.current = atlasId;
  const onHoverLeaveRef = useRef(onHoverLeave);
  onHoverLeaveRef.current = onHoverLeave;

  interface Drag {
    pinId: Id;
    pointerId: number;
    startX: number;
    startY: number;
    origin: { x: number; y: number };
    moved: boolean;
  }
  const dragRef = useRef<Drag | null>(null);

  const detach = useCallback(() => {
    document.removeEventListener("pointermove", onDocMove);
    document.removeEventListener("pointerup", onDocUp);
    document.removeEventListener("pointercancel", onDocUp);
  }, []);

  const onDocMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const api = apiRef.current;
    if (!api || !api.imgW || !api.imgH) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) <= MOVE_THRESHOLD) return;
      drag.moved = true;
      // History snapshots the pre-drag pin on the first real move, so a
      // click-select (no drag) never pushes a no-op undo step.
      useScriptorium.getState().pushHistory(atlasIdRef.current);
    }
    const nextX = clamp01(drag.origin.x + dx / (api.imgW * api.scale));
    const nextY = clamp01(drag.origin.y + dy / (api.imgH * api.scale));
    useScriptorium.getState().movePin(drag.pinId, nextX, nextY);
  }, []);

  const onDocUp = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      detach();
    },
    [detach],
  );

  useEffect(
    () => () => {
      dragRef.current = null;
      detach();
    },
    [detach],
  );

  if (!transformApi.imgW || !transformApi.imgH) return null;

  const startDrag = (pin: Pin, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelectPin(pin.id);
    onHoverLeaveRef.current();
    if (typeof e.currentTarget.setPointerCapture === "function") {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* jsdom / pointer already released */
      }
    }
    dragRef.current = {
      pinId: pin.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: { x: pin.x, y: pin.y },
      moved: false,
    };
    document.addEventListener("pointermove", onDocMove);
    document.addEventListener("pointerup", onDocUp);
    document.addEventListener("pointercancel", onDocUp);
  };

  const reportHover = (pinId: Id, e: ReactPointerEvent<HTMLButtonElement>) => {
    const stageEl = e.currentTarget.closest(".stage");
    if (!stageEl) return;
    const rect = stageEl.getBoundingClientRect();
    onHoverEnter(
      pinId,
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      { w: stageEl.clientWidth, h: stageEl.clientHeight },
    );
  };

  return (
    <div className="pin-layer">
      {pins.map((pin) => {
        const selected = pin.id === selectedPinId;
        return (
          <div
            key={pin.id}
            className="atlas-pin"
            data-pin-id={pin.id}
            style={{ ...pinStyle(pin, transformApi), pointerEvents: interactive ? "auto" : "none" }}
          >
            <button
              type="button"
              className={"pin-dot" + (selected ? " selected" : "")}
              style={{ "--pin-color": pin.color } as CSSProperties}
              aria-label={pin.label || "Pino"}
              aria-pressed={selected}
              onPointerDown={(e) => startDrag(pin, e)}
              onPointerEnter={(e) => reportHover(pin.id, e)}
              onPointerLeave={onHoverLeave}
            >
              <svg width={PIN_SIZE_PX} height={PIN_SIZE_PX} viewBox="0 0 18 18" aria-hidden="true">
                {selected ? <circle className="pin-ring-outer" cx="9" cy="9" r="9.2" /> : null}
                <circle className="pin-ring" cx="9" cy="9" r="7.5" />
                <circle className="pin-core" cx="9" cy="9" r="5.5" />
                <text className="pin-icon" x="9" y="11.8" textAnchor="middle">
                  {PIN_TYPE_META[pin.type].icon}
                </text>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
