import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Atlas, Pt } from "../../domain/types";
import { useScriptorium } from "../../data/store";
import { AtlasEditor } from "./AtlasEditor";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
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

const BIG: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const SMALL: Pt[] = [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.1 }, { x: 0.3, y: 0.3 }, { x: 0.1, y: 0.3 }];

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

function mountEditor(atlas: Atlas) {
  const { container } = render(
    <MemoryRouter>
      <AtlasEditor atlasId={atlas.id} />
    </MemoryRouter>,
  );
  const stageEl = screen.getByTestId("stage");
  stubStageLayout(stageEl, { left: 0, top: 0, w: 800, h: 600 }, { w: 800, h: 600 });
  const img = stageEl.querySelector(".stage-map") as HTMLImageElement;
  expect(img).toBeTruthy();
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: 800 });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: 600 });
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

function polyByFill(container: HTMLElement, color: string): SVGPolygonElement {
  const poly = Array.from(container.querySelectorAll("polygon.region-poly"))
    .find((p) => p.getAttribute("fill") === color);
  expect(poly, `polygon with fill ${color} should exist`).toBeTruthy();
  return poly as SVGPolygonElement;
}

describe("AtlasEditor — RegionLayer", () => {
  it("renders regions area-desc (bigger painted first) with fill color, base opacity and non-scaling stroke", () => {
    const atlas = makeAtlas([
      { points: BIG, color: "#123456", label: "Grande" },
      { points: SMALL, color: "#654321", label: "Pequeno" },
    ]);
    const { container } = mountEditor(atlas);
    const polys = Array.from(container.querySelectorAll("polygon.region-poly"));
    expect(polys).toHaveLength(2);
    expect(polys[0].getAttribute("points")).toBe("0,0 800,0 800,600 0,600");
    expect(polys[0].getAttribute("fill")).toBe("#123456");
    expect(polys[1].getAttribute("fill")).toBe("#654321");
    expect(polys[0].getAttribute("fill-opacity")).toBe("0.28");
    expect(polys[1].getAttribute("fill-opacity")).toBe("0.28");
    expect(polys[0].getAttribute("vector-effect")).toBe("non-scaling-stroke");
    expect(polys[0].getAttribute("pointer-events")).toBe("auto");
  });

  it("renders labels at the region centroid in image px", () => {
    const atlas = makeAtlas([
      { points: BIG, color: "#123456", label: "Grande" },
      { points: SMALL, color: "#654321", label: "Pequeno" },
    ]);
    const { container } = mountEditor(atlas);
    const texts = Array.from(container.querySelectorAll("text.region-label"));
    expect(texts).toHaveLength(2);
    expect(texts[0].textContent).toBe("Grande");
    expect(texts[0].getAttribute("x")).toBe("400");
    expect(texts[0].getAttribute("y")).toBe("300");
    expect(texts[1].textContent).toBe("Pequeno");
    expect(texts[1].getAttribute("x")).toBe("160");
    expect(texts[1].getAttribute("y")).toBe("120");
    expect(texts[1].getAttribute("font-size")).toBe("12");
    expect(texts[1].getAttribute("text-anchor")).toBe("middle");
  });
});

describe("AtlasEditor — draw flow (region tool)", () => {
  it("3 clicks + Enter adds the region with the exact normalized points and selects it", () => {
    const atlas = makeAtlas([]);
    const { stageEl, container } = mountEditor(atlas);
    pickTool("Region");
    clickStage(stageEl, 100, 60, 11);
    clickStage(stageEl, 300, 120, 12);
    clickStage(stageEl, 260, 220, 13);
    expect(store().atlases[0].regions).toHaveLength(0);

    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });
    const regions = store().atlases[0].regions;
    expect(regions).toHaveLength(1);
    expect(regions[0].points).toHaveLength(3);
    expect(regions[0].points[0].x).toBeCloseTo(0.125, 12);
    expect(regions[0].points[0].y).toBeCloseTo(0.1, 12);
    expect(regions[0].points[1].x).toBeCloseTo(0.375, 12);
    expect(regions[0].points[1].y).toBeCloseTo(0.2, 12);
    expect(regions[0].points[2].x).toBeCloseTo(0.325, 12);
    expect(regions[0].points[2].y).toBeCloseTo(220 / 600, 12);
    expect(container.querySelector("polygon.draw-preview")).toBeNull();
    expect(polyByFill(container, regions[0].color).getAttribute("fill-opacity")).toBe("0.43");
  });

  it("Escape during draw clears the vertices and adds nothing", () => {
    const atlas = makeAtlas([]);
    const { stageEl, container } = mountEditor(atlas);
    pickTool("Region");
    clickStage(stageEl, 100, 60, 11);
    clickStage(stageEl, 300, 120, 12);
    expect(container.querySelector("polygon.draw-preview")).not.toBeNull();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(container.querySelector("polygon.draw-preview")).toBeNull();
    expect(container.querySelector(".draw-first-marker")).toBeNull();
    act(() => {
      fireEvent.keyDown(document, { key: "Enter" });
    });
    expect(store().atlases[0].regions).toHaveLength(0);
  });

  it("click right after the first vertex closes the region (Enter not needed)", () => {
    const atlas = makeAtlas([{ points: BIG, color: "#123456", label: "Grande" }]);
    const { stageEl } = mountEditor(atlas);
    pickTool("Region");
    clickStage(stageEl, 100, 60, 11);
    clickStage(stageEl, 300, 120, 12);
    clickStage(stageEl, 260, 220, 13);
    // 1px right of first vertex → screen dist 1px, well under the 14px close radius
    clickStage(stageEl, 101, 60, 14);
    const regions = store().atlases[0].regions;
    expect(regions).toHaveLength(2); // fixture "Grande" + drawn
    expect(regions[1].points).toHaveLength(3);
  });
});

describe("AtlasEditor — select tool", () => {
  it("picks the smallest-area region containing the clicked point", () => {
    const atlas = makeAtlas([
      { points: BIG, color: "#123456", label: "Grande" },
      { points: SMALL, color: "#654321", label: "Pequeno" },
    ]);
    const { stageEl, container } = mountEditor(atlas);
    clickStage(stageEl, 200, 150); // (0.25, 0.25) — inside both
    expect(polyByFill(container, "#654321").getAttribute("fill-opacity")).toBe("0.43");
    expect(polyByFill(container, "#123456").getAttribute("fill-opacity")).toBe("0.28");

    clickStage(stageEl, 700, 560); // (0.875, 0.933) — inside big only
    expect(polyByFill(container, "#123456").getAttribute("fill-opacity")).toBe("0.43");
    expect(polyByFill(container, "#654321").getAttribute("fill-opacity")).toBe("0.28");
  });

  it("dblclick opens the chooser (options desc by area + None); pick selects, None clears; outside closes", () => {
    const atlas = makeAtlas([
      { points: BIG, color: "#123456", label: "Grande" },
      { points: SMALL, color: "#654321", label: "Pequeno" },
    ]);
    const { stageEl, container } = mountEditor(atlas);
    const chooserQuery = () => screen.queryByRole("dialog", { name: "Pick region" });

    act(() => {
      fireEvent.dblClick(stageEl, { clientX: 200, clientY: 150 });
    });
    const chooser = chooserQuery();
    expect(chooser).toBeTruthy();
    const labels = Array.from(chooser!.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toEqual(["Grande", "Pequeno", "None"]);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "None" }));
    });
    expect(chooserQuery()).toBeNull();
    expect(polyByFill(container, "#123456").getAttribute("fill-opacity")).toBe("0.28");
    expect(polyByFill(container, "#654321").getAttribute("fill-opacity")).toBe("0.28");

    act(() => {
      fireEvent.dblClick(stageEl, { clientX: 200, clientY: 150 });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Pequeno" }));
    });
    expect(chooserQuery()).toBeNull();
    expect(polyByFill(container, "#654321").getAttribute("fill-opacity")).toBe("0.43");
    expect(polyByFill(container, "#123456").getAttribute("fill-opacity")).toBe("0.28");

    act(() => {
      fireEvent.dblClick(stageEl, { clientX: 200, clientY: 150 });
    });
    expect(chooserQuery()).toBeTruthy();
    act(() => {
      fireEvent.pointerDown(container.querySelector(".chooser-backdrop")!);
    });
    expect(chooserQuery()).toBeNull();
  });
});
