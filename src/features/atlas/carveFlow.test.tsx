import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Atlas, Pt } from "../../domain/types";
import { polygonArea, snapToCarveBorder } from "../../domain/geometry";
import { useScriptorium } from "../../data/store";
import { AtlasEditor } from "./AtlasEditor";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
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

// Parent (Estado): left border sits at x=0.2 with an extra collinear vertex at
// (0.2,0.5) — border snaps resolve and detectCarveParent accepts its boundary.
const PARENT: Pt[] = [
  { x: 0.2, y: 0.2 },
  { x: 1, y: 0.2 },
  { x: 1, y: 0.8 },
  { x: 0.2, y: 0.8 },
];
const PARENT_COLOR = "#123456";
const DECOY: Pt[] = [
  { x: 0.01, y: 0.9 },
  { x: 0.1, y: 0.9 },
  { x: 0.1, y: 0.99 },
  { x: 0.01, y: 0.99 },
];
const LEFT = [
  { x: 0, y: 0 },
  { x: 0.45, y: 0 },
  { x: 0.45, y: 1 },
  { x: 0, y: 1 },
];
const RIGHT = [
  { x: 0.55, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0.55, y: 1 },
];

function makeAtlas(regions: Array<{ points: Pt[]; color: string; label: string }>): Atlas {
  let a!: Atlas;
  act(() => {
    a = store().addAtlas("prj_fix", "Mundo");
    store().putMapImage(a.id, "data:image/svg+xml,%3Csvg/%3E");
    a = store().atlases.find((x) => x.id === a.id)!;
    for (const r of regions) store().addRegion(a.id, r);
  });
  return store().atlases.find((x) => x.id === a.id)!;
}

function mountEditor(atlas: Atlas, natural: { w: number; h: number } = { w: 800, h: 600 }) {
  const { container } = render(<AtlasEditor atlasId={atlas.id} />);
  const stageEl = screen.getByTestId("stage");
  stubStageLayout(stageEl, { left: 0, top: 0, w: 800, h: 600 }, { w: 800, h: 600 });
  const img = stageEl.querySelector(".stage-map") as HTMLImageElement;
  expect(img).toBeTruthy();
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: natural.w });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: natural.h });
  act(() => {
    fireEvent.load(img);
  });
  return { container, stageEl };
}

function pickTool(name: string) {
  act(() => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

function pickMode(name: string) {
  act(() => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

const pressed = (name: string) =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed") === "true";

// jsdom has no PointerEvent; dispatch a real-ish pointer event manually.
function firePointer(el: HTMLElement, type: string, init: { clientX: number; clientY: number; pointerId?: number }) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(e, {
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    button: { value: 0 },
    buttons: { value: type.endsWith("up") ? 0 : 1 },
    pointerId: { value: init.pointerId ?? 1 },
    pointerType: { value: "mouse" },
  });
  act(() => {
    el.dispatchEvent(e);
  });
}

function clickStage(stageEl: HTMLElement, x: number, y: number, pointerId = 1) {
  firePointer(stageEl, "pointerdown", { pointerId, clientX: x, clientY: y });
  firePointer(stageEl, "pointerup", { pointerId, clientX: x, clientY: y });
}

function previewPoints(el: Element): Array<[number, number]> {
  return el
    .getAttribute("points")!
    .split(" ")
    .map((s) => s.split(",").map(Number) as [number, number]);
}

function parentPoly(container: HTMLElement): SVGPolygonElement {
  const poly = Array.from(container.querySelectorAll("polygon.region-poly")).find(
    (p) => p.getAttribute("fill") === PARENT_COLOR,
  );
  expect(poly, "parent polygon should exist").toBeTruthy();
  return poly as SVGPolygonElement;
}

/** Region tool + carve, then the 4-click fixture: vertex A (0.2,0.2), two
 *  middles, border point (0.2,0.5). Returns a mount with preview showing. */
function setupCarve(modeName: string, atlas?: Atlas, natural?: { w: number; h: number }) {
  const a = atlas ?? makeAtlas([{ points: PARENT, color: PARENT_COLOR, label: "Estado" }]);
  const mounted = mountEditor(a, natural);
  pickTool("Ferramenta região");
  pickMode(modeName);
  clickStage(mounted.stageEl, 166, 120, 11); // near vertex A → snap
  clickStage(mounted.stageEl, 320, 210, 12); // middle (0.4,0.35)
  clickStage(mounted.stageEl, 400, 270, 13); // middle (0.5,0.45)
  clickStage(mounted.stageEl, 163, 300, 14); // near left border → exit snap (0.2,0.5)
  return mounted;
}

describe("carve mode", () => {
  it("snaps first and last vertices to the parent border, previews the carve and marks the parent", () => {
    const { container } = setupCarve("Carve");
    const preview = container.querySelector("polygon.carve-preview") as SVGPolygonElement;
    expect(preview).toBeTruthy();
    // forward child: entry A → middles → exit (0.2,0.5)
    const pts = previewPoints(preview);
    expect(pts).toHaveLength(4);
    const expected = [[160, 120], [320, 210], [400, 270], [160, 300]] as const;
    pts.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(expected[i][0], 6);
      expect(p[1]).toBeCloseTo(expected[i][1], 6);
    });
    expect(container.querySelectorAll(".carve-snap-marker")).toHaveLength(2);
    expect(parentPoly(container).classList.contains("carve-parent")).toBe(true);
    expect(container.querySelector("polygon.draw-preview")).toBeNull();
    expect(store().atlases[0].regions).toHaveLength(1);
  });

  it("confirm adds the child and trims the parent to the opposite path", () => {
    const { container } = setupCarve("Carve");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Aplicar recorte" }));
    });
    const regions = store().atlases[0].regions;
    expect(regions).toHaveLength(2);
    const child = regions[1];
    expect(child.points).toHaveLength(4);
    expect(child.points[0].x).toBeCloseTo(0.2, 12);
    expect(child.points[1].x).toBeCloseTo(0.4, 12);
    expect(child.points[1].y).toBeCloseTo(0.35, 12);
    expect(child.points[2].x).toBeCloseTo(0.5, 12);
    expect(child.points[3].y).toBeCloseTo(0.5, 12);
    expect(child.fillOpacity).toBe(0.28);
    expect(child.label).toBe("");
    // parent trimmed to the backward walk: entry, middles, exit + border vertices
    const parent = regions[0];
    expect(parent.points).toHaveLength(7);
    expect(parent.points[1].x).toBeCloseTo(0.4, 12);
    expect(parent.points[2].x).toBeCloseTo(0.5, 12);
    expect(parent.points[3].y).toBeCloseTo(0.5, 12);
    expect(parent.points[4]).toEqual({ x: 0.2, y: 0.8 });
    expect(parent.points[5]).toEqual({ x: 1, y: 0.8 });
    expect(parent.points[6]).toEqual({ x: 1, y: 0.2 });
    expect(store().toasts[store().toasts.length - 1].message).toBe("Região recortada — nomeie.");
    expect(container.querySelector("polygon.carve-preview")).toBeNull();
    expect(container.querySelector(".atlas-editor")?.getAttribute("data-tool")).toBe("select");
  });

  it("flip button swaps the preview to the other walk and confirm uses it", () => {
    const { container } = setupCarve("Carve");
    const preview = () => container.querySelector("polygon.carve-preview") as SVGPolygonElement;
    expect(previewPoints(preview())).toHaveLength(4);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Outro lado" }));
    });
    // flipped preview = backward walk: exit side + parent border vertices
    expect(previewPoints(preview())).toHaveLength(7);
    const flipped = previewPoints(preview());
    expect(flipped[4][0]).toBeCloseTo(160, 6); // (0.2,0.8)
    expect(flipped[4][1]).toBeCloseTo(480, 6);
    expect(flipped[5][0]).toBeCloseTo(800, 6); // (1,0.8)
    expect(flipped[6][0]).toBeCloseTo(800, 6); // (1,0.2)
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Aplicar recorte" }));
    });
    const regions = store().atlases[0].regions;
    expect(regions[1].points).toHaveLength(7); // child = flipped path
    expect(regions[0].points).toHaveLength(4); // parent trimmed to former forward path
    expect(regions[0].points[1].y).toBeCloseTo(0.35, 12);
  });

  it("Escape clears preview and draw state but the carve mode stays armed", () => {
    const { container, stageEl } = setupCarve("Carve");
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(container.querySelector("polygon.carve-preview")).toBeNull();
    expect(container.querySelectorAll(".carve-snap-marker")).toHaveLength(0);
    expect(parentPoly(container).classList.contains("carve-parent")).toBe(false);
    expect(store().atlases[0].regions).toHaveLength(1);
    expect(pressed("Carve")).toBe(true);
    // mode still carve: a new border click re-arms the parent
    clickStage(stageEl, 166, 120, 15);
    expect(parentPoly(container).classList.contains("carve-parent")).toBe(true);
    expect(container.querySelector("polygon.carve-preview")).toBeNull();
    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });
    expect(store().atlases[0].regions).toHaveLength(1); // incomplete draw: nothing committed
  });
});

describe("neighbor mode", () => {
  it("snaps against the nearest region, adds the child but never trims the parent", () => {
    const atlas = makeAtlas([
      { points: PARENT, color: PARENT_COLOR, label: "Estado" },
      { points: DECOY, color: "#654321", label: "Longe" },
    ]);
    const { container } = setupCarve("Vizinho", atlas);
    expect(parentPoly(container).classList.contains("carve-parent")).toBe(true);
    const decoyPoly = Array.from(container.querySelectorAll("polygon.region-poly")).find(
      (p) => p.getAttribute("fill") === "#654321",
    );
    expect(decoyPoly?.classList.contains("carve-parent") ?? false).toBe(false);
    expect(container.querySelector("polygon.carve-preview")).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Aplicar recorte" }));
    });
    const regions = store().atlases[0].regions;
    expect(regions).toHaveLength(3);
    const parent = regions[0];
    expect(parent.points).toEqual(PARENT); // untouched — neighbor does not trim
    const child = regions[2];
    expect(child.points.length).toBeGreaterThanOrEqual(4);
    expect(child.points[0].x).toBeCloseTo(0.2075, 12);
    expect(child.points[1].x).toBeCloseTo(0.4, 12);
    expect(store().toasts[store().toasts.length - 1].message).toBe("Região vizinha — nomeie.");
  });
});

describe("fit mode", () => {
  it("Enter fits the drawing into the uncovered gap", () => {
    const atlas = makeAtlas([
      { points: LEFT, color: "#123456", label: "Oeste" },
      { points: RIGHT, color: "#654321", label: "Leste" },
    ]);
    const { container, stageEl } = mountEditor(atlas);
    pickTool("Ferramenta região");
    pickMode("Encaixe");
    clickStage(stageEl, 376, 120, 11); // (0.47,0.2)
    clickStage(stageEl, 424, 120, 12); // (0.53,0.2)
    clickStage(stageEl, 424, 480, 13); // (0.53,0.8)
    clickStage(stageEl, 376, 480, 14); // (0.47,0.8)
    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });
    const regions = store().atlases[0].regions;
    expect(regions).toHaveLength(3);
    const fitted = regions[2];
    expect(polygonArea(fitted.points)).toBeCloseTo(0.06 * 0.6, 5);
    expect(fitted.points.every((p) => p.x >= 0.47 - 1e-9 && p.x <= 0.53 + 1e-9)).toBe(true);
    expect(store().toasts[store().toasts.length - 1].message).toBe("Região encaixada — nomeie.");
    expect(container.querySelector("polygon.draw-preview")).toBeNull();
  });

  it("drawing over a covered area toasts and adds no region", () => {
    const atlas = makeAtlas([
      { points: LEFT, color: "#123456", label: "Oeste" },
      { points: RIGHT, color: "#654321", label: "Leste" },
    ]);
    const { stageEl } = mountEditor(atlas);
    pickTool("Ferramenta região");
    pickMode("Encaixe");
    clickStage(stageEl, 80, 120, 11); // (0.1,0.2)
    clickStage(stageEl, 240, 120, 12); // (0.3,0.2)
    clickStage(stageEl, 240, 480, 13); // (0.3,0.8)
    clickStage(stageEl, 80, 480, 14); // (0.1,0.8)
    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });
    expect(store().atlases[0].regions).toHaveLength(2);
    expect(store().toasts[store().toasts.length - 1].message).toBe("Não sobrou área para encaixar.");
  });
});

describe("mode toggles", () => {
  it("are exclusive, toggle off on second click and only exist in the region tool", () => {
    const atlas = makeAtlas([{ points: PARENT, color: PARENT_COLOR, label: "Estado" }]);
    const { stageEl } = mountEditor(atlas);
    expect(screen.queryByRole("button", { name: "Carve" })).toBeNull();
    pickTool("Ferramenta região");
    expect(screen.getByRole("button", { name: "Carve" })).toBeTruthy();
    pickMode("Vizinho");
    expect(pressed("Vizinho")).toBe(true);
    expect(pressed("Carve")).toBe(false);
    pickMode("Encaixe");
    expect(pressed("Encaixe")).toBe(true);
    expect(pressed("Vizinho")).toBe(false);
    pickMode("Encaixe");
    expect(pressed("Encaixe")).toBe(false);
    void stageEl;
  });
});

describe("carve px convention (imgW × scale)", () => {
  // 1600×600 image at scale 1: pxPerUnit = 1600 regardless of imgH.
  const WIDE_PARENT: Pt[] = [
    { x: 0.2, y: 0.2 },
    { x: 0.2, y: 0.5 },
    { x: 0.2, y: 0.8 },
    { x: 1, y: 0.8 },
    { x: 1, y: 0.2 },
  ];

  it("rejects a 0.01 vertex offset (16px > 14) and accepts 0.008 (12.8 ≤ 14)", () => {
    expect(snapToCarveBorder({ x: 0.21, y: 0.501 }, [{ id: "p", points: WIDE_PARENT }], 1600)).toBeNull();
    const hit = snapToCarveBorder({ x: 0.208, y: 0.501 }, [{ id: "p", points: WIDE_PARENT }], 1600);
    expect(hit?.regionId).toBe("p");
    expect(hit?.point).toEqual({ x: 0.2, y: 0.5 });
  });

  it("flow: the wide-image fixture snaps through the editor with pxPerUnit = imgW", () => {
    const atlas = makeAtlas([{ points: WIDE_PARENT, color: PARENT_COLOR, label: "Estado" }]);
    const { container, stageEl } = mountEditor(atlas, { w: 1600, h: 600 });
    pickTool("Ferramenta região");
    pickMode("Carve");
    // 0.01 offset = 16 px > 14 → no snap → free draw fallback
    clickStage(stageEl, 336, 301, 21);
    expect(parentPoly(container).classList.contains("carve-parent")).toBe(false);
    const marker = container.querySelector("circle.draw-first-marker") as SVGCircleElement;
    expect(Number(marker.getAttribute("cx"))).toBeCloseTo(336, 6); // raw click, unsnapped
    // Escape resets the machine (mode stays), then 0.008 ≈ 12.8 px ≤ 14 → snap
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    clickStage(stageEl, 332.8, 301, 22);
    expect(parentPoly(container).classList.contains("carve-parent")).toBe(true);
    const snapped = container.querySelector("circle.draw-first-marker") as SVGCircleElement;
    expect(Number(snapped.getAttribute("cx"))).toBeCloseTo(320, 6); // vertex (0.2,·) exact
  });

  it("an imgH-based pxPerUnit would wrongly accept the rejected offset (documents the convention)", () => {
    expect(
      snapToCarveBorder({ x: 0.21, y: 0.501 }, [{ id: "p", points: WIDE_PARENT }], 600),
    ).not.toBeNull();
  });
});