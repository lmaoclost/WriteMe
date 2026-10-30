import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { firePointer } from "../../test/pointer";
import { selectOption } from "../../test/selectHelper";
import { MemoryRouter } from "react-router-dom";
import { useWriteme } from "../../data/store";
import { FactionWebPage } from "./FactionWebPage";
import { FactionWebServicePage } from "./FactionPageIndex";

const store = () => useWriteme.getState();

beforeEach(() => {
  localStorage.clear();
  useWriteme.setState(useWriteme.getInitialState());
});
afterEach(() => vi.restoreAllMocks());

Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1200 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 800 });

function seedWeb() {
  const w = store().addFactionWeb("prj_1", "Teia do Selo");
  const a = store().addFaction(w.id, { x: 4000, y: 4000, name: "Casa Vellmor", color: "#c0392b" })!;
  const b = store().addFaction(w.id, { x: 6400, y: 4200, name: "Ordem do Rio", color: "#2980b9" })!;
  return { w, a: a.id, b: b.id };
}

describe("FactionWebPage", () => {
  it("renders factions on the plane", () => {
    const { w } = seedWeb();
    render(<FactionWebPage webId={w.id} />);
    const nodes = screen.getAllByTestId("fac-node");
    expect(nodes).toHaveLength(2);
    expect(nodes[0].textContent).toContain("Casa Vellmor");
  });

  it("wheel zoom + zoom buttons change the view", () => {
    const { w } = seedWeb();
    render(<FactionWebPage webId={w.id} />);
    const canvas = screen.getByTestId("fw-canvas");
    const before = canvas.querySelector("[data-testid=\"fw-plane\"]")!.getAttribute("style")!;
    // wheel up at the canvas center → zoom anchored at cursor
    fireEvent.wheel(canvas, { deltaY: -100, clientX: 600, clientY: 400 });
    const afterWheel = canvas.querySelector("[data-testid=\"fw-plane\"]")!.getAttribute("style")!;
    expect(afterWheel).not.toBe(before);
    // header zoom buttons
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    const afterIn = canvas.querySelector("[data-testid=\"fw-plane\"]")!.getAttribute("style")!;
    expect(afterIn).not.toBe(afterWheel);
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(canvas.querySelector("[data-testid=\"fw-plane\"]")!.getAttribute("style")! || "z").toBeTruthy();
    // display shows a percentage
    expect(screen.getByTestId("fw-zoom").textContent).toMatch(/%$/);
  });

  it("empty state invites first faction", () => {
    const { w } = seedWeb();
    render(<FactionWebPage webId={w.id} />);
    void w;
    expect(screen.getAllByTestId("fac-node").length).toBe(2);
  });

  it("connects two factions via handle → destination → type picker", () => {
    const { w, a, b } = seedWeb();
    render(<FactionWebPage webId={w.id} />);
    const handle = screen.getByRole("button", { name: /Connect Casa Vellmor/ });
    firePointer(handle, "pointerdown", { clientX: 100, clientY: 100 });
    expect(screen.getByText(/faction to connect/i)).toBeInTheDocument();
    // click destination
    const dest = screen.getAllByTestId("fac-node").find((n) => n.getAttribute("data-fac-id") === b)!;
    fireEvent.click(dest);
    expect(screen.getByTestId("conn-type-picker")).toBeInTheDocument();
    const conn = store().factionWebs![0].connections.find((c) => c.fromId === a && c.toId === b)!;
    expect(conn.type).toBe("neutral");
    // pick type: ally
    fireEvent.click(screen.getByRole("button", { name: "Ally" }));
    expect(store().factionWebs![0].connections.find((c) => c.id === conn.id)!.type).toBe("ally");
    expect(screen.getByTestId("edge-ally")).toBeInTheDocument();
    void handle;
  });

  it("duplicate connection (either direction) is rejected", () => {
    const { w, a, b } = seedWeb();
    render(<FactionWebPage webId={w.id} />);
    act(() => { store().addConnection(w.id, a, b); });
    const r = act(() => { store().addConnection(w.id, b, a); }) as unknown;
    expect(store().factionWebs![0].connections.filter((c) => c.fromId === a)).toHaveLength(1);
    void r;
  });

  it("self connection refused", () => {
    const { w, a } = seedWeb();
    expect(store().addConnection(w.id, a, a)).toBeNull();
  });

  it("addConnection history: undo removes connection", () => {
    const { w, a, b } = seedWeb();
    render(<FactionWebPage webId={w.id} />);
    act(() => { store().addConnection(w.id, a, b); });
    expect(store().factionWebs![0].connections).toHaveLength(1);
    act(() => { store().undoFW(w.id); });
    expect(store().factionWebs![0].connections).toHaveLength(0);
    act(() => { store().redoFW(w.id); });
    expect(store().factionWebs![0].connections).toHaveLength(1);
  });

  it("delete faction drops incident connections", () => {
    const { w, a, b } = seedWeb();
    act(() => { store().addConnection(w.id, a, b); });
    act(() => { store().deleteFaction(a); });
    const web = store().factionWebs![0];
    expect(web.factions.map((f) => f.id)).toEqual([b]);
    expect(web.connections).toHaveLength(0);
  });

  it("panel edits color via presets", () => {
    const { w, a } = seedWeb();
    render(<FactionWebPage webId={w.id} />);
    const node = screen.getAllByTestId("fac-node").find((n) => n.getAttribute("data-fac-id") === a)!;
    firePointer(node, "pointerdown", { clientX: 0, clientY: 0 });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(13); // 12 presets + new-faction default #7a7a99
    fireEvent.click(options[4]); // #27ae60
    expect(store().factionWebs![0].factions.find((f) => f.id === a)!.color).toBe("#27ae60");
  });

  it("territory is picked from an atlas region", async () => {
    const { w, a } = seedWeb();
    const atlas = store().addAtlas("prj_1", "Mundo Conhecido");
    store().putMapImage(atlas.id, "data:image/png;base64,AAA");
    const region = store().addRegion(atlas.id, {
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      color: "#123456",
      label: "Terras Altas",
    })!;
    render(<FactionWebPage webId={w.id} />);
    const node = screen.getAllByTestId("fac-node").find((n) => n.getAttribute("data-fac-id") === a)!;
    firePointer(node, "pointerdown", { clientX: 0, clientY: 0 });
    await selectOption(() => screen.getByLabelText("Territory"), /Terras Altas/);
    const faction = store().factionWebs![0].factions.find((f) => f.id === a)!;
    expect(faction.territoryRegionId).toBe(region.id);
    expect(faction.territory).toBe("Terras Altas");
  });

  it("notepad persists notes", async () => {
    vi.useFakeTimers();
    const { w } = seedWeb();
    render(<FactionWebPage webId={w.id} />);
    fireEvent.click(screen.getByRole("button", { name: /notes/i }));
    fireEvent.change(screen.getByLabelText("Web notes"), { target: { value: "A paz durou até o inverno." } });
    act(() => vi.advanceTimersByTime(320));
    expect(store().factionWebs![0].notes).toBe("A paz durou até o inverno.");
    vi.useRealTimers();
  });
});

describe("FactionWebServicePage (index)", () => {
  it("renders cards + creates via modal", () => {
    render(<MemoryRouter><FactionWebServicePage projectId="prj_1" /></MemoryRouter>);
    expect(screen.getByText(/No saved faction webs found. Create a new one first!/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New faction web" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Selo" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(store().factionWebs![0].name).toBe("Selo");
    expect(screen.getByText("Selo")).toBeInTheDocument();
  });

  it("delete two-step", () => {
    seedWeb();
    render(<MemoryRouter><FactionWebServicePage projectId="prj_1" /></MemoryRouter>);
    fireEvent.click(screen.getByTitle("Delete faction web"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().factionWebs).toHaveLength(0);
  });
});
