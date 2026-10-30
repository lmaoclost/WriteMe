import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Stage } from "./Stage";
import type { TransformApi } from "./useStageTransform";
import { snapToCarveBorder } from "../../../domain/geometry";
import type { Atlas, Pt } from "../../../domain/types";
import { useWriteme } from "../../../data/store";

const store = () => useWriteme.getState();

beforeEach(() => {
  localStorage.clear();
  useWriteme.setState(useWriteme.getInitialState());
});

afterEach(() => {
  vi.restoreAllMocks();
});

type Rect = { left: number; top: number; w: number; h: number };

function stubStageLayout(el: HTMLElement, rect: Rect, client?: { w: number; h: number }) {
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      width: rect.w,
      height: rect.h,
      right: rect.left + rect.w,
      bottom: rect.top + rect.h,
      x: rect.left,
      y: rect.top,
      toJSON: () => rect,
    }) as DOMRect;
  if (client) {
    Object.defineProperty(el, "clientWidth", { configurable: true, value: client.w });
    Object.defineProperty(el, "clientHeight", { configurable: true, value: client.h });
  }
}

function makeAtlas(withMap = true): Atlas {
  let a!: Atlas;
  act(() => {
    a = store().addAtlas("prj_1", "Mundo");
  });
  if (withMap) {
    act(() => {
      store().putMapImage(a.id, "data:image/svg+xml,%3Csvg/%3E");
    });
    a = store().atlases.find((x) => x.id === a.id)!;
  }
  return a;
}

interface StageOptions {
  atlas?: Atlas;
  rect?: Rect;
  client?: { w: number; h: number };
  layer?: ReactNode;
  overlayChildren?: (api: TransformApi) => ReactNode;
  onStageClick?(pt: Pt, clientX: number, clientY: number): void;
  onStageMove?(pt: Pt, clientX: number, clientY: number): void;
  onStageDblClick?(pt: Pt, clientX: number, clientY: number): void;
}

interface Mount {
  api(): TransformApi;
  stageEl: HTMLElement;
  container: HTMLElement;
}

function mountStage(opts: StageOptions = {}): Mount {
  const atlas = opts.atlas ?? makeAtlas(true);
  let captured: TransformApi | null = null;
  const { container } = render(
    <Stage
      atlas={atlas}
      onStageClick={opts.onStageClick}
      onStageMove={opts.onStageMove}
      onStageDblClick={opts.onStageDblClick}
      overlayChildren={opts.overlayChildren}
    >
      {(api) => {
        captured = api;
        return opts.layer ?? null;
      }}
    </Stage>,
  );
  const stageEl = screen.getByTestId("stage");
  const rect = opts.rect ?? { left: 0, top: 0, w: 800, h: 600 };
  stubStageLayout(stageEl, rect, opts.client ?? { w: rect.w, h: rect.h });
  return { api: () => captured as TransformApi, stageEl, container };
}

function loadMapImage(scope: HTMLElement, w = 800, h = 600) {
  const img = scope.querySelector(".stage-map") as HTMLImageElement;
  expect(img).toBeTruthy();
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: w });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: h });
  act(() => {
    fireEvent.load(img);
  });
  return img;
}

type TouchPoint = { clientX: number; clientY: number };

function fireTouch(el: HTMLElement, type: string, touches: TouchPoint[]) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "touches", { value: touches });
  act(() => {
    el.dispatchEvent(e);
  });
}

// jsdom has no PointerEvent; RTL's fallback drops all init keys. Dispatch a
// real-ish pointer event manually with the fields the hook reads.
interface PointerInit {
  clientX: number;
  clientY: number;
  button?: number;
  pointerId?: number;
  pointerType?: string;
}

function firePointer(el: HTMLElement, type: string, init: PointerInit) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(e, {
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    button: { value: init.button ?? 0 },
    buttons: { value: type.endsWith("up") || type.endsWith("cancel") ? 0 : 1 },
    pointerId: { value: init.pointerId },
    pointerType: { value: init.pointerType ?? "mouse" },
  });
  act(() => {
    el.dispatchEvent(e);
  });
}

// jsdom applies no real CSS transforms, so composited placement can't be read
// off the DOM. Emulate CSS function-list composition instead: the matrices
// post-multiply in string order (rightmost function acts on the point first), so
// a function list [a, b] is the product M_a · M_b. With those matrices the
// counter-transform can be asserted as the exact identity against
// .stage-content's wrapper transform.
type Matrix = [number, number, number, number, number, number]; // matrix(a, b, c, d, e, f)

function mulMatrix(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function parseTransformList(t: string): Matrix {
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  const re = /(translate|scale)\(([^)]*)\)/g;
  for (let hit = re.exec(t); hit; hit = re.exec(t)) {
    const args = hit[2].split(",").map((v) => parseFloat(v));
    m = mulMatrix(
      m,
      hit[1] === "translate" ? ([1, 0, 0, 1, args[0], args[1]] as Matrix) : ([args[0], 0, 0, args[0], 0, 0] as Matrix),
    );
  }
  return m;
}

/** The counter must undo the content wrapper exactly: composite matrix ≈ I
 *  (scale product ≈ 1, pan terms sum to ≈ 0 — the order bug drifted by (1−s)·pan). */
function expectCompositeIdentity(content: string, counter: string) {
  const [a, b, c, d, e, f] = mulMatrix(parseTransformList(content), parseTransformList(counter));
  expect(a).toBeCloseTo(1, 12);
  expect(d).toBeCloseTo(1, 12);
  expect(b).toBeCloseTo(0, 12);
  expect(c).toBeCloseTo(0, 12);
  expect(e).toBeCloseTo(0, 12);
  expect(f).toBeCloseTo(0, 12);
}

describe("overlay-dom counter transform", () => {
  function counterEl(container: HTMLElement): HTMLElement {
    const dom = container.querySelector(".stage-overlay-dom") as HTMLElement;
    expect(dom, "overlay-dom layer should render").toBeTruthy();
    return dom;
  }

  it("counter is the exact string inverse after a zoom-driven 2× at (400, 0) → pan (−400, 0)", () => {
    const m = mountStage({ overlayChildren: () => <div data-testid="overlay-dom" /> });
    loadMapImage(m.container);
    // The zoom function the wheel handler drives (zoomAtPoint at the cursor):
    // 2× anchored at (400, 0) → scale 2, pan (−400, 0).
    act(() => m.api().zoomAtPoint(400, 0, 2));
    expect(m.api().scale).toBe(2);
    expect(m.api().panX).toBe(-400);
    expect(m.api().panY).toBe(0);
    const content = m.container.querySelector(".stage-content") as HTMLElement;
    expect(content.style.transform).toBe("translate(-400px, 0px) scale(2)");
    expect(counterEl(m.container).style.transform).toBe("scale(0.5) translate(400px, 0px)");
    expectCompositeIdentity(content.style.transform, counterEl(m.container).style.transform);
  });

  it("counter composes to identity against .stage-content after a real wheel zoom (drift repro)", () => {
    const m = mountStage({ overlayChildren: () => <div data-testid="overlay-dom" /> });
    loadMapImage(m.container);
    act(() => {
      fireEvent.wheel(m.stageEl, { clientX: 400, clientY: 300, deltaY: -100 });
    });
    expect(m.api().scale).toBeCloseTo(1.1, 12);
    const content = m.container.querySelector(".stage-content") as HTMLElement;
    expectCompositeIdentity(content.style.transform, counterEl(m.container).style.transform);
  });

  it("counter stays composed-identity at idle (s=1, pan=0) and after a drag pan", () => {
    const m = mountStage({ overlayChildren: () => <div data-testid="overlay-dom" /> });
    loadMapImage(m.container);
    let content = m.container.querySelector(".stage-content") as HTMLElement;
    expectCompositeIdentity(content.style.transform, counterEl(m.container).style.transform);
    firePointer(m.stageEl, "pointerdown", { pointerId: 7, clientX: 100, clientY: 100, button: 0, pointerType: "mouse" });
    firePointer(m.stageEl, "pointermove", { pointerId: 7, clientX: 160, clientY: 130, pointerType: "mouse" });
    content = m.container.querySelector(".stage-content") as HTMLElement;
    expectCompositeIdentity(content.style.transform, counterEl(m.container).style.transform);
  });
});

describe("Stage render", () => {
  it("S1: image load fits the stage immediately (scale min(cw/naw, ch/nah), centered)", () => {
    // Stage 395×701, image 1024×640 → scale 0.3857 (width-limited), pan ≥ 0.
    const m = mountStage({ rect: { left: 0, top: 0, w: 395, h: 701 }, client: { w: 395, h: 701 } });
    expect(m.api().scale).toBe(1); // before load: scale-1 view
    loadMapImage(m.container, 1024, 640);
    expect(m.api().scale).toBeCloseTo(395 / 1024, 12);
    expect(m.api().panX).toBeCloseTo((395 - 1024 * (395 / 1024)) / 2, 12);
    expect(m.api().panY).toBeCloseTo((701 - 640 * (395 / 1024)) / 2, 12);
    expect(m.api().panX).toBeGreaterThanOrEqual(0);
    expect(m.api().panY).toBeGreaterThanOrEqual(0);
    // The image fits: fitted rect (pan + natural·scale) stays inside the stage.
    const right = m.api().panX + 1024 * m.api().scale;
    const bottom = m.api().panY + 640 * m.api().scale;
    expect(right).toBeLessThanOrEqual(395 + 1e-9);
    expect(bottom).toBeLessThanOrEqual(701 + 1e-9);
  });

  it("S1 fallback: load with an unmeasurable stage resets to scale 1 / pan 0", () => {
    const m = mountStage({ client: { w: 0, h: 0 } });
    loadMapImage(m.container);
    expect(m.api().scale).toBe(1);
    expect(m.api().panX).toBe(0);
    expect(m.api().panY).toBe(0);
  });

  it("renders img + overlay svg with viewBox from natural size after load", () => {
    const m = mountStage();
    expect(m.api().imgW).toBe(0);
    const img = loadMapImage(m.container);
    expect(img.className).toContain("stage-map");
    expect(img.getAttribute("draggable")).toBe("false");
    expect(m.api().imgW).toBe(800);
    expect(m.api().imgH).toBe(600);
    const svg = m.container.querySelector("svg.stage-overlay")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 600");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
    expect(m.stageEl).toHaveClass("stage");
  });

  it("renders children (overlay layers) even without a map, with 1x1 viewBox, and suppresses point callbacks", () => {
    const onStageMove = vi.fn();
    const onStageClick = vi.fn();
    const m = mountStage({
      atlas: makeAtlas(false),
      onStageMove,
      onStageClick,
      layer: <div data-testid="layer-sentinel" />,
    });
    expect(m.container.querySelector(".stage-map")).toBeNull();
    const svg = m.container.querySelector("svg.stage-overlay")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 1 1");
    expect(screen.getByTestId("layer-sentinel")).toBeTruthy();
    expect(m.api().fromClient(10, 10)).toBeNull();
    act(() => m.api().fitToContainer());
    expect(m.api().scale).toBe(1);
    firePointer(m.stageEl, "pointermove", { clientX: 120, clientY: 90 });
    expect(onStageMove).not.toHaveBeenCalled();
  });
});

describe("Stage transform", () => {
  it("zoomAtPoint doubles scale while keeping the anchored stage point fixed", () => {
    const m = mountStage();
    loadMapImage(m.container);
    const before = m.api().fromClient(400, 300)!;
    act(() => m.api().zoomAtPoint(400, 300, 2));
    expect(m.api().scale).toBe(2);
    expect(m.api().fromClient(400, 300)).toEqual(before);
  });

  it("wheel anchors zoom on the cursor and prevents default while a map is loaded", () => {
    const prevent = vi.spyOn(Event.prototype, "preventDefault");
    const m = mountStage();
    loadMapImage(m.container);
    const before = m.api().fromClient(400, 300)!;
    act(() => {
      fireEvent.wheel(m.stageEl, { clientX: 400, clientY: 300, deltaY: -100 });
    });
    expect(m.api().scale).toBeCloseTo(1.1, 12);
    const after = m.api().fromClient(400, 300)!;
    expect(after.x).toBeCloseTo(before.x, 12);
    expect(after.y).toBeCloseTo(before.y, 12);
    expect(prevent).toHaveBeenCalled();
    act(() => {
      fireEvent.wheel(m.stageEl, { clientX: 400, clientY: 300, deltaY: 100 });
    });
    expect(m.api().scale).toBeCloseTo(1, 12);
  });

  it("wheel does not prevent default (nor zoom) without a map", () => {
    const prevent = vi.spyOn(Event.prototype, "preventDefault");
    const m = mountStage({ atlas: makeAtlas(false) });
    act(() => {
      fireEvent.wheel(m.stageEl, { clientX: 400, clientY: 300, deltaY: -100 });
    });
    expect(prevent).not.toHaveBeenCalled();
    expect(m.api().scale).toBe(1);
  });

  it("zoomBy anchors at container center and clamps to floor 0.1 / cap 8", () => {
    const m = mountStage();
    loadMapImage(m.container);
    const center = m.api().fromClient(400, 300)!;
    act(() => m.api().zoomBy(2));
    expect(m.api().scale).toBe(2);
    expect(m.api().fromClient(400, 300)).toEqual(center);
    act(() => m.api().zoomBy(99));
    expect(m.api().scale).toBe(8);
    act(() => m.api().zoomBy(0.001));
    expect(m.api().scale).toBe(0.1);
    act(() => m.api().zoomAtPoint(400, 300, 99));
    expect(m.api().scale).toBe(8);
  });

  it("fitToContainer uses min(cw/imgW, ch/imgH), centers, and clamps", () => {
    const m = mountStage();
    loadMapImage(m.container);
    stubStageLayout(m.stageEl, { left: 0, top: 0, w: 800, h: 600 }, { w: 1600, h: 1200 });
    act(() => m.api().fitToContainer());
    expect(m.api().scale).toBe(2);
    expect(m.api().panX).toBe(0);
    expect(m.api().panY).toBe(0);

    stubStageLayout(m.stageEl, { left: 0, top: 0, w: 800, h: 600 }, { w: 9000, h: 5500 });
    act(() => m.api().fitToContainer());
    expect(m.api().scale).toBe(8);
    expect(m.api().panX).toBe((9000 - 800 * 8) / 2);
    expect(m.api().panY).toBe((5500 - 600 * 8) / 2);

    stubStageLayout(m.stageEl, { left: 0, top: 0, w: 800, h: 600 }, { w: 60, h: 40 });
    act(() => m.api().fitToContainer());
    expect(m.api().scale).toBe(0.1);
  });

  it("drag pans only past the 5px threshold and toggles the dragging class", () => {
    const m = mountStage();
    loadMapImage(m.container);
    firePointer(m.stageEl, "pointerdown", { pointerId: 1, clientX: 100, clientY: 100, button: 0, pointerType: "mouse" });
    firePointer(m.stageEl, "pointermove", { pointerId: 1, clientX: 104, clientY: 100, pointerType: "mouse" });
    expect(m.api().panX).toBe(0);
    expect(m.api().panY).toBe(0);
    firePointer(m.stageEl, "pointermove", { pointerId: 1, clientX: 160, clientY: 130, pointerType: "mouse" });
    expect(m.api().panX).toBe(60);
    expect(m.api().panY).toBe(30);
    expect(m.stageEl).toHaveClass("dragging");
    firePointer(m.stageEl, "pointerup", { pointerId: 1, clientX: 160, clientY: 130, button: 0, pointerType: "mouse" });
    expect(m.stageEl).not.toHaveClass("dragging");
  });

  it("click without move surfaces onStageClick with the normalized point", () => {
    const onStageClick = vi.fn();
    const m = mountStage({ onStageClick });
    loadMapImage(m.container);
    firePointer(m.stageEl, "pointerdown", { pointerId: 2, clientX: 50, clientY: 48, button: 0, pointerType: "mouse" });
    firePointer(m.stageEl, "pointerup", { pointerId: 2, clientX: 51, clientY: 49, button: 0, pointerType: "mouse" });
    expect(onStageClick).toHaveBeenCalledTimes(1);
    const [pt, cx, cy] = onStageClick.mock.calls[0];
    expect(pt).toEqual({ x: 51 / 800, y: 49 / 600 });
    expect(cx).toBe(51);
    expect(cy).toBe(49);
  });

  it("click after a real drag (>5px) is suppressed; a fresh down/up still clicks", () => {
    const onStageClick = vi.fn();
    const m = mountStage({ onStageClick });
    loadMapImage(m.container);
    firePointer(m.stageEl, "pointerdown", { pointerId: 3, clientX: 100, clientY: 100, button: 0, pointerType: "mouse" });
    firePointer(m.stageEl, "pointermove", { pointerId: 3, clientX: 160, clientY: 100, pointerType: "mouse" });
    firePointer(m.stageEl, "pointerup", { pointerId: 3, clientX: 160, clientY: 100, button: 0, pointerType: "mouse" });
    expect(onStageClick).not.toHaveBeenCalled();
    firePointer(m.stageEl, "pointerdown", { pointerId: 3, clientX: 100, clientY: 100, button: 0, pointerType: "mouse" });
    firePointer(m.stageEl, "pointerup", { pointerId: 3, clientX: 100, clientY: 100, button: 0, pointerType: "mouse" });
    expect(onStageClick).toHaveBeenCalledTimes(1);
  });

  it("touch pinch scales by distance ratio around the midpoint", () => {
    const m = mountStage();
    loadMapImage(m.container);
    const before = m.api().fromClient(150, 100)!;
    fireTouch(m.stageEl, "touchstart", [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 100 },
    ]);
    fireTouch(m.stageEl, "touchmove", [
      { clientX: 50, clientY: 100 },
      { clientX: 250, clientY: 100 },
    ]);
    expect(m.api().scale).toBe(2);
    const after = m.api().fromClient(150, 100)!;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(m.api().panX).toBe(150 - before.x * 800 * 2);
  });

  it("surfaces onStageMove and onStageDblClick with normalized points", () => {
    const onStageMove = vi.fn();
    const onStageDblClick = vi.fn();
    const m = mountStage({ onStageMove, onStageDblClick });
    loadMapImage(m.container);
    firePointer(m.stageEl, "pointermove", { clientX: 120, clientY: 90, pointerType: "mouse" });
    expect(onStageMove).toHaveBeenCalledTimes(1);
    expect(onStageMove.mock.calls[0][0]).toEqual({ x: 120 / 800, y: 90 / 600 });
    expect(onStageMove.mock.calls[0][1]).toBe(120);
    expect(onStageMove.mock.calls[0][2]).toBe(90);
    act(() => {
      fireEvent.doubleClick(m.stageEl, { clientX: 200, clientY: 300 });
    });
    expect(onStageDblClick).toHaveBeenCalledTimes(1);
    expect(onStageDblClick.mock.calls[0][0]).toEqual({ x: 200 / 800, y: 300 / 600 });
  });

  it("toClient maps normalized points to stage-relative client px (anisotropic)", () => {
    const m = mountStage();
    loadMapImage(m.container);
    expect(m.api().toClient({ x: 0.5, y: 0.25 })).toEqual({ left: 400, top: 150 });
    act(() => m.api().zoomAtPoint(400, 300, 2));
    expect(m.api().toClient({ x: 0.5, y: 0.25 })).toEqual({ left: 400, top: 0 });
  });

  it("AT1 ruling: conversion is anisotropic and snap pxPerUnit is imgW*scale", () => {
    const m = mountStage();
    loadMapImage(m.container);
    const a = m.api().fromClient(400, 300)!;
    const b = m.api().fromClient(480, 360)!;
    expect(b.x - a.x).toBeCloseTo(0.1, 12);
    expect(b.y - a.y).toBeCloseTo(0.1, 12);

    const region = { id: "r1", points: [{ x: 0.9, y: 0.1 }, { x: 0.95, y: 0.1 }, { x: 0.9, y: 0.15 }] };
    const pxPerUnitX = 800; // imgW * scale(x=1)
    expect(snapToCarveBorder({ x: 0.89, y: 0.1 }, [region], pxPerUnitX))
      .toEqual({ point: { x: 0.9, y: 0.1 }, regionId: "r1" });
    expect(snapToCarveBorder({ x: 0.88, y: 0.1 }, [region], pxPerUnitX)).toBeNull();
    expect(snapToCarveBorder({ x: 0.88, y: 0.1 }, [region], 600)).not.toBeNull();
  });
});
