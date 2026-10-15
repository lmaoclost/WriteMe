import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Atlas, PinType, Pt, Region, WorldEntry } from "../../domain/types";
import { polygonArea } from "../../domain/geometry";
import { useScriptorium } from "../../data/store";
import { getRecentColors, resetRecentColors } from "./panels/recentColors";
import { LinkPicker } from "./panels/LinkPicker";
import { AtlasEditor } from "./AtlasEditor";

const store = () => useScriptorium.getState();

const ENTRIES: WorldEntry[] = [
  { id: "ent_sol", projectId: "prj_fix", title: "Reinos do Sol", category: "place", body: "", links: [] },
  { id: "ent_herd", projectId: "prj_fix", title: "Herdeiros do Fim", category: "person", body: "", links: [] },
  { id: "ent_relic", projectId: "prj_fix", title: "Relíquia do Véu", category: "item", body: "", links: [] },
];

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
  useScriptorium.setState({ entries: ENTRIES.map((e) => ({ ...e })) });
  resetRecentColors();
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

type PinFixture = { x: number; y: number; type?: PinType; color?: string; label?: string; entryId?: string };

function makeAtlas(fixtures: { regions?: Array<Pick<Region, "points" | "color" | "label">>; pins?: PinFixture[] } = {}): Atlas {
  let a!: Atlas;
  act(() => {
    a = store().addAtlas("prj_fix", "Mundo");
    store().putMapImage(a.id, "data:image/svg+xml,%3Csvg/%3E");
    a = store().atlases.find((x) => x.id === a.id)!;
    for (const r of fixtures.regions ?? []) store().addRegion(a.id, r);
    for (const p of fixtures.pins ?? []) store().addPin(a.id, p);
  });
  return store().atlases.find((x) => x.id === a.id)!;
}

function mountEditor(atlas: Atlas, natural: { w: number; h: number } = { w: 800, h: 600 }) {
  const { container } = render(
    <MemoryRouter>
      <AtlasEditor atlasId={atlas.id} />
    </MemoryRouter>,
  );
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

function pickButton(name: string) {
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

function pinDot(container: HTMLElement): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>(".pin-dot");
  expect(btn, "pin dot should exist").toBeTruthy();
  return btn!;
}

function pinWrapper(container: HTMLElement): HTMLElement {
  const div = container.querySelector<HTMLElement>(".atlas-pin");
  expect(div, "pin wrapper should exist").toBeTruthy();
  return div!;
}

function selectPinByClick(container: HTMLElement, x = 200, y = 150, pointerId = 31) {
  const btn = pinDot(container);
  firePointer(btn, "pointerdown", { pointerId, clientX: x, clientY: y });
  firePointer(btn, "pointerup", { pointerId, clientX: x, clientY: y });
  return btn;
}

function firePinHover(btn: Element, type: "pointerover" | "pointerout", x: number, y: number) {
  const e = new Event(type, { bubbles: true });
  Object.defineProperties(e, {
    clientX: { value: x },
    clientY: { value: y },
    pointerType: { value: "mouse" },
  });
  act(() => {
    btn.dispatchEvent(e);
  });
}

describe("pin layer", () => {
  it("pin tool: a stage click places a pin at normalized coords with the legacy pinStyle offset", () => {
    const atlas = makeAtlas();
    const { container, stageEl } = mountEditor(atlas);
    pickButton("Ferramenta pino");
    clickStage(stageEl, 208, 150, 11); // (0.26, 0.25)
    const pins = store().atlases[0].pins;
    expect(pins).toHaveLength(1);
    expect(pins[0].x).toBeCloseTo(0.26, 9);
    expect(pins[0].y).toBeCloseTo(0.25, 9);
    expect(pins[0].type).toBe("place");
    const div = pinWrapper(container);
    expect(parseFloat(div.style.left)).toBeCloseTo(0.26 * 800 - 9, 6);
    expect(parseFloat(div.style.top)).toBeCloseTo(0.25 * 600 - 9, 6);
    expect(div.querySelector(".pin-dot svg")).toBeTruthy();
    // the new pin is auto-selected → PinPanel replaces the placeholder
    expect(screen.getByLabelText("Pin label")).toBeTruthy();
  });

  it("dragging a selected pin 40px right moves it by 40/(imgW·scale) and undo restores the origin", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    const id = store().atlases[0].pins[0].id;
    const btn = pinDot(container);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    firePointer(btn, "pointerdown", { pointerId: 31, clientX: 200, clientY: 150 });
    expect(btn.getAttribute("aria-pressed")).toBe("true"); // selected on pointerdown
    firePointer(btn, "pointermove", { pointerId: 31, clientX: 240, clientY: 150 });
    const pin = store().atlases[0].pins[0];
    expect(pin.x).toBeCloseTo(0.3, 9); // 0.25 + 40/800
    expect(pin.y).toBeCloseTo(0.25, 9);
    expect(pin.id).toBe(id);
    firePointer(btn, "pointerup", { pointerId: 31, clientX: 240, clientY: 150 });
    act(() => {
      store().undo(atlas.id);
    });
    expect(store().atlases[0].pins[0].x).toBeCloseTo(0.25, 9);
    expect(store().atlases[0].pins[0].y).toBeCloseTo(0.25, 9);
  });

  it("pushes history on the first real drag move, not on click-select or wiggle", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    const undoCount = () => store().histories[atlas.id]?.undo.length ?? 0;
    const after = undoCount(); // snapshot whatever setup pushed
    selectPinByClick(container);
    expect(undoCount()).toBe(after); // select-only pointerdown: no history entry
    const btn = pinDot(container);
    firePointer(btn, "pointerdown", { pointerId: 31, clientX: 200, clientY: 150 });
    firePointer(btn, "pointermove", { pointerId: 31, clientX: 203, clientY: 151 }); // ≤5px wiggle
    expect(undoCount()).toBe(after);
    firePointer(btn, "pointermove", { pointerId: 31, clientX: 240, clientY: 150 }); // first real move
    expect(undoCount()).toBe(after + 1);
  });

  it("a ≤5px pointer wiggle selects but never moves the pin", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    const btn = pinDot(container);
    firePointer(btn, "pointerdown", { pointerId: 31, clientX: 200, clientY: 150 });
    firePointer(btn, "pointermove", { pointerId: 31, clientX: 203, clientY: 151 });
    firePointer(btn, "pointerup", { pointerId: 31, clientX: 203, clientY: 151 });
    expect(store().atlases[0].pins[0].x).toBeCloseTo(0.25, 9);
    expect(store().atlases[0].pins[0].y).toBeCloseTo(0.25, 9);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("pin drag maps x by imgW and y by imgH (wide/tall image) and clamps at the border", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas, { w: 1600, h: 600 });
    // S1: fit-on-load → scale 0.5, so the conversion divisor is imgW·scale = 800 / imgH·scale = 300.
    const btn = pinDot(container);
    firePointer(btn, "pointerdown", { pointerId: 31, clientX: 400, clientY: 450 });
    firePointer(btn, "pointermove", { pointerId: 31, clientX: 480, clientY: 300 });
    let pin = store().atlases[0].pins[0];
    expect(pin.x).toBeCloseTo(0.35, 9); // 0.25 + 80/800
    expect(pin.y).toBeCloseTo(0, 9); // 0.25 - 150/300 → clamped at 0
    firePointer(btn, "pointerup", { pointerId: 31, clientX: 480, clientY: 300 });
    // another drag upward would overshoot → clamped at 0
    firePointer(btn, "pointerdown", { pointerId: 32, clientX: 480, clientY: 300 });
    firePointer(btn, "pointermove", { pointerId: 32, clientX: 480, clientY: 150 });
    firePointer(btn, "pointerup", { pointerId: 32, clientX: 480, clientY: 150 });
    pin = store().atlases[0].pins[0];
    expect(pin.x).toBeCloseTo(0.35, 9);
    expect(pin.y).toBeCloseTo(0, 9);
    expect(Number.isFinite(pin.y)).toBe(true);
  });

  it("pin drag never pans the stage (transform untouched after a real drag)", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    const content = container.querySelector<HTMLElement>(".stage-content")!;
    const before = content.getAttribute("style");
    expect(before).toContain("translate(0px, 0px) scale(1)");
    const btn = pinDot(container);
    firePointer(btn, "pointerdown", { pointerId: 31, clientX: 200, clientY: 150 });
    firePointer(btn, "pointermove", { pointerId: 31, clientX: 240, clientY: 150 });
    firePointer(btn, "pointerup", { pointerId: 31, clientX: 240, clientY: 150 });
    expect(content.getAttribute("style")).toBe(before);
  });
});

describe("hover tooltip (div hoverCard)", () => {
  it("hovering a pin shows label + linked entry title near the cursor, clamped inside the stage; leave hides", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Capital", entryId: "ent_sol" }] });
    const { container } = mountEditor(atlas);
    const btn = pinDot(container);
    firePinHover(btn, "pointerover", 205, 155);
    const tip = screen.getByTestId("pin-tooltip") as HTMLElement;
    expect(tip.textContent).toContain("Capital");
    expect(tip.textContent).toContain("Reinos do Sol");
    const left = parseFloat(tip.style.left);
    const top = parseFloat(tip.style.top);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThanOrEqual(800);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(600);
    firePinHover(btn, "pointerout", 205, 155);
    expect(screen.queryByTestId("pin-tooltip")).toBeNull();
  });

  it("an unlinked pin tooltip shows just the label", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Torre" }] });
    const { container } = mountEditor(atlas);
    firePinHover(pinDot(container), "pointerover", 90, 80);
    const tip = screen.getByTestId("pin-tooltip") as HTMLElement;
    expect(tip.textContent).toContain("Torre");
    expect(tip.textContent).not.toContain("Reinos do Sol");
  });
});

describe("Delete key", () => {
  it("Delete deletes the selected pin (store history; undo restores) and clears the selection", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    selectPinByClick(container);
    act(() => {
      fireEvent.keyDown(document, { key: "Delete" });
    });
    expect(store().atlases[0].pins).toHaveLength(0);
    expect(screen.getByText("Selecione ou crie um pino ou região.")).toBeTruthy();
    act(() => {
      store().undo(atlas.id);
    });
    expect(store().atlases[0].pins).toHaveLength(1);
  });

  it("Delete is ignored while the focus is in a panel input, then works after blur", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    const btn = selectPinByClick(container);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    const input = screen.getByLabelText("Pin label") as HTMLInputElement;
    act(() => {
      input.focus();
    });
    act(() => {
      fireEvent.keyDown(input, { key: "Delete" });
    });
    expect(store().atlases[0].pins).toHaveLength(1);
    act(() => {
      input.blur();
      fireEvent.keyDown(document, { key: "Delete" });
    });
    expect(store().atlases[0].pins).toHaveLength(0);
  });
});

describe("PinPanel", () => {
  it("label input commits through updatePin as you type", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    selectPinByClick(container);
    const input = screen.getByLabelText("Pin label") as HTMLInputElement;
    expect(input).toHaveValue("Cidade");
    act(() => {
      fireEvent.change(input, { target: { value: "Nova Capital" } });
    });
    expect(store().atlases[0].pins[0].label).toBe("Nova Capital");
  });

  it("label typing keeps the link picker open (reset effect keys on pin id only)", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    selectPinByClick(container);
    pickButton("Link entry");
    expect(screen.getByLabelText("Search entries")).toBeTruthy();
    act(() => {
      const input = screen.getByLabelText("Pin label") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Nova Capital" } });
    });
    expect(screen.getByLabelText("Search entries")).toBeTruthy(); // closed on typing before the rekey
  });

  it("type segmented control switches the pin type", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    selectPinByClick(container);
    pickButton("Pessoa");
    expect(store().atlases[0].pins[0].type).toBe("person");
    pickButton("Item");
    expect(store().atlases[0].pins[0].type).toBe("item");
  });

  it("color swatch updates the color and feeds the recent singleton", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    selectPinByClick(container);
    expect(screen.queryByText("Recentes")).toBeNull();
    pickButton("Cor #2ecc71");
    expect(store().atlases[0].pins[0].color).toBe("#2ecc71");
    expect(getRecentColors()).toContain("#2ecc71");
    expect(screen.getByText("Recentes")).toBeTruthy();
  });
});

describe("LinkPicker", () => {
  it("filters case-insensitively by title substring, caps the list at 8 and shows No matching entries", () => {
    const many = ENTRIES.concat(
      Array.from({ length: 7 }, (_, i) => ({
        id: `ent_x${i}`,
        projectId: "prj_fix",
        title: `Lugar ${i}`,
        category: "place" as const,
        body: "",
        links: [],
      })),
    );
    const onPick = vi.fn();
    const onClear = vi.fn();
    const { container } = render(<LinkPicker entries={many} onPick={onPick} onClear={onClear} />);
    expect(container.querySelectorAll(".link-list button")).toHaveLength(8); // max 8
    const search = screen.getByLabelText("Search entries") as HTMLInputElement;
    act(() => {
      fireEvent.change(search, { target: { value: "herd" } }); // lowercase substring
    });
    const buttons = Array.from(container.querySelectorAll(".link-list button"));
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe("Herdeiros do Fim");
    act(() => {
      fireEvent.change(search, { target: { value: "zzz-nada" } });
    });
    expect(screen.getByText("No matching entries.")).toBeTruthy();
  });

  it("pick forwards the entry id; unlink is offered for the current entry", () => {
    const onPick = vi.fn();
    const onClear = vi.fn();
    render(
      <MemoryRouter>
        <LinkPicker entries={ENTRIES} currentEntryId="ent_sol" onPick={onPick} onClear={onClear} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Unlink Herdeiros do Fim")).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByLabelText("Unlink Herdeiros do Fim"));
    });
    expect(onClear).toHaveBeenCalledTimes(1);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Relíquia do Véu" }));
    });
    expect(onPick).toHaveBeenCalledWith("ent_relic");
  });
});

describe("pin link through the panel", () => {
  it("Link entry opens the picker; picking writes entryId; unlink clears it", () => {
    const atlas = makeAtlas({ pins: [{ x: 0.25, y: 0.25, label: "Cidade" }] });
    const { container } = mountEditor(atlas);
    selectPinByClick(container);
    pickButton("Link entry");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Herdeiros do Fim" }));
    });
    expect(store().atlases[0].pins[0].entryId).toBe("ent_herd");
    pickButton("Link entry");
    act(() => {
      fireEvent.click(screen.getByLabelText("Unlink Herdeiros do Fim"));
    });
    expect(store().atlases[0].pins[0].entryId).toBeUndefined();
  });
});

const FRAME: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const CHILD: Pt[] = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 }];

function mountClaimAtlas() {
  const atlas = makeAtlas({
    regions: [
      { points: FRAME, color: "#123456", label: "Império" },
      { points: CHILD, color: "#654321", label: "Núcleo" },
    ],
  });
  const { container, stageEl } = mountEditor(atlas);
  clickStage(stageEl, 600, 150); // (0.75, 0.25) — inside the frame only
  return { atlas, container, stageEl };
}

describe("RegionPanel", () => {
  it("opacity slider writes fillOpacity and the label shows the %; label input commits too", () => {
    const { container, atlas } = mountClaimAtlas();
    expect(screen.queryByLabelText("Pin label")).toBeNull();
    const slider = screen.getByLabelText("Fill opacity") as HTMLInputElement;
    expect(screen.getByTestId("opacity-value").textContent).toBe("28%");
    act(() => {
      fireEvent.change(slider, { target: { value: "0.5" } });
    });
    const region = store().atlases.find((a) => a.id === atlas.id)!.regions[0];
    expect(region.fillOpacity).toBe(0.5);
    expect(screen.getByTestId("opacity-value").textContent).toBe("50%");
    expect(screen.getByTestId("vertex-count").textContent).toBe("Vertices: 4");
    const input = screen.getByLabelText("Region label") as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "Terras Altas" } });
    });
    expect(store().atlases.find((a) => a.id === atlas.id)!.regions[0].label).toBe("Terras Altas");
    void container;
  });

  it("Claim remaining area creates the L-shaped remainder with the legacy color and toasts", () => {
    const { atlas } = mountClaimAtlas();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Claim remaining area" }));
    });
    const regions = store().atlases.find((a) => a.id === atlas.id)!.regions;
    expect(regions).toHaveLength(3);
    const claimed = regions[2];
    expect(polygonArea(claimed.points)).toBeCloseTo(0.75, 3);
    expect(claimed.color).toBe("#2ecc71");
    expect(store().toasts[store().toasts.length - 1].message).toBe("1 area claimed — name it.");
  });

  it("claim with nothing left toasts the error and creates nothing", () => {
    let a!: Atlas;
    act(() => {
      a = store().addAtlas("prj_fix", "Mundo");
      store().putMapImage(a.id, "data:image/svg+xml,%3Csvg/%3E");
      a = store().atlases.find((x) => x.id === a.id)!;
      store().addRegion(a.id, { points: FRAME, color: "#123456", label: "Tudo" });
      store().addRegion(a.id, { points: FRAME, color: "#654321", label: "Igual" });
    });
    const atlas = store().atlases.find((x) => x.id === a.id)!;
    const { stageEl } = mountEditor(atlas);
    clickStage(stageEl, 600, 150); // smallest containing = first frame
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Claim remaining area" }));
    });
    expect(store().atlases.find((x) => x.id === atlas.id)!.regions).toHaveLength(2);
    expect(store().toasts[store().toasts.length - 1].message).toBe("No un-regioned area left in this State.");
  });

  it("region delete is a two-step confirm (Delete region → Confirm?) and clears the selection", () => {
    const { container } = mountClaimAtlas();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Delete region" }));
    });
    expect(screen.getByRole("button", { name: "Confirm?" })).toBeTruthy();
    expect(store().atlases[0].regions).toHaveLength(2); // nothing deleted yet
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    });
    expect(store().atlases[0].regions).toHaveLength(1);
    expect(screen.getByText("Selecione ou crie um pino ou região.")).toBeTruthy();
    void container;
  });

  it("pin panel wins over region panel when both selections are alive", () => {
    const atlas = makeAtlas({
      regions: [{ points: FRAME, color: "#123456", label: "Império" }],
      pins: [{ x: 0.25, y: 0.25, label: "Cidade" }],
    });
    const { container, stageEl } = mountEditor(atlas);
    clickStage(stageEl, 700, 500); // select region
    expect(screen.getByLabelText("Region label")).toBeTruthy();
    act(() => {
      const btn = pinDot(container);
      firePointer(btn, "pointerdown", { pointerId: 31, clientX: 200, clientY: 150 });
      firePointer(btn, "pointerup", { pointerId: 31, clientX: 200, clientY: 150 });
    });
    expect(screen.getByLabelText("Pin label")).toBeTruthy();
    expect(screen.queryByLabelText("Region label")).toBeNull();
  });
});
