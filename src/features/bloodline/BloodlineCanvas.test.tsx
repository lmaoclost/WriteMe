import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { firePointer } from "../../test/pointer";
import { useScriptorium } from "../../data/store";
import { BloodlineIndexPage } from "./BloodlineIndexPage";
import { BloodlineCanvasPage } from "./BloodlineCanvas";
import type { Bloodline, BloodlinePerson } from "../../domain/types";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});
afterEach(() => vi.restoreAllMocks());

// fit math needs real-ish stage dimensions in jsdom
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1200 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 800 });

function makeBloodline(): Bloodline {
  let b!: Bloodline;
  act(() => { b = store().addBloodline("prj_1", "Vellmor"); });
  return b;
}

function addPersonAt(bloodlineId: string, x: number, y: number, name = "Aldric"): BloodlinePerson {
  const r = store().addPerson(bloodlineId, { x, y, name });
  if (!r) throw new Error("addPerson falhou");
  return r;
}

describe("BloodlineIndexPage", () => {
  it("empty state invites creating", () => {
    render(<MemoryRouter><BloodlineIndexPage projectId="prj_1" /></MemoryRouter>);
    expect(screen.getByText(/Create a new family tree from scratch/i)).toBeInTheDocument();
  });

  it("creates a bloodline via modal", async () => {
    render(<MemoryRouter><BloodlineIndexPage projectId="prj_1" /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "New bloodline" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Vellmor" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(store().bloodlines.map((b) => b.name)).toEqual(["Vellmor"]);
  });

  it("shows cards with counts and links to the canvas", () => {
    const b = makeBloodline();
    addPersonAt(b.id, 4000, 4000);
    render(<MemoryRouter><BloodlineIndexPage projectId="prj_1" /></MemoryRouter>);
    expect(screen.getByText("Vellmor")).toBeInTheDocument();
    expect(screen.getByText(/1 person/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vellmor/ })).toHaveAttribute("href", `/p/prj_1/bloodline/${b.id}`);
  });

  it("deletes two-step", () => {
    const b = makeBloodline();
    void b;
    render(<MemoryRouter><BloodlineIndexPage projectId="prj_1" /></MemoryRouter>);
    fireEvent.click(screen.getByTitle("Delete bloodline"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().bloodlines).toHaveLength(0);
  });
});

describe("BloodlineCanvasPage", () => {
  function mount(b: Bloodline) {
    return render(
      <MemoryRouter initialEntries={[`/p/prj_1/bloodline/${b.id}`]}>
        <BloodlineCanvasPage bloodlineId={b.id} />
      </MemoryRouter>,
    );
  }
  it("renders persons on the plane with transform", () => {
    const b = makeBloodline();
    addPersonAt(b.id, 4200, 4300, "Aldric");
    mount(b);
    const node = screen.getByTestId("person-node");
    expect(node.textContent).toContain("Aldric");
    const plane = screen.getByTestId("bl-plane");
    expect(plane.style.transform).toMatch(/scale/);
  });

  it("initial fit places the content onscreen (not the whole 20k plane)", () => {
    vi.useFakeTimers();
    const b = makeBloodline();
    addPersonAt(b.id, 240, 140, "Aldric");
    addPersonAt(b.id, 620, 420, "Ora");
    mount(b);
    act(() => { vi.advanceTimersByTime(10); }); // fit runs on a 0ms timeout
    const plane = screen.getByTestId("bl-plane");
    const m = plane.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)$/);
    expect(m).toBeTruthy();
    const px = Number(m![1]);
    const py = Number(m![2]);
    const s = Number(m![3]);
    // every node's screen position must land inside the 1200×800 stub canvas
    for (const n of store().bloodlines[0].persons) {
      const sx = n.x * s + px;
      const sy = n.y * s + py;
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sx).toBeLessThanOrEqual(1200);
      expect(sy).toBeGreaterThanOrEqual(0);
      expect(sy).toBeLessThanOrEqual(800);
    }
    vi.useRealTimers();
  });

  it("empty state invites founder", () => {
    const b = makeBloodline();
    mount(b);
    expect(screen.getByText(/fundador|primeira pessoa/i)).toBeInTheDocument();
  });

  it("add person button creates and selects", () => {
    const b = makeBloodline();
    mount(b);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar pessoa/i }));
    expect(store().bloodlines[0].persons).toHaveLength(1);
    expect(screen.getByTestId("person-node")).toBeInTheDocument();
  });

  it("drag moves a person by pointer events", () => {
    vi.useFakeTimers();
    const b = makeBloodline();
    const p = addPersonAt(b.id, 4000, 4000);
    mount(b);
    act(() => { vi.advanceTimersByTime(10); }); // content-fit fires on a 0ms timeout
    const node = screen.getByTestId("person-node");
    firePointer(node, "pointerdown", { clientX: 100, clientY: 100 });
    firePointer(node, "pointermove", { clientX: 140, clientY: 100 });
    firePointer(node, "pointerup", { clientX: 140, clientY: 100 });
    const moved = store().bloodlines[0].persons.find((x) => x.id === p.id)!;
    // content-fit initial view: single person → scale capped at 1 → 40 screen px = 40 canvas px
    expect(moved.x).toBe(4040);
    // undo restores
    act(() => { store().undoBL(b.id); });
    expect(store().bloodlines[0].persons.find((x) => x.id === p.id)!.x).toBe(4000);
    vi.useRealTimers();
  });

  it("edges render for connected persons and vanish on delete", () => {
    const b = makeBloodline();
    const father = addPersonAt(b.id, 4000, 4000);
    const child = addPersonAt(b.id, 4000, 4400, "Filho");
    act(() => { store().updatePerson(child.id, { connectedTo: father.id }); });
    mount(b);
    expect(screen.getByTestId("edge-blood")).toBeInTheDocument();
    act(() => { store().deletePerson(father.id); });
    void b; // store updated
    expect(store().bloodlines[0].persons.find((p) => p.id === child.id)?.connectedTo).toBeUndefined();
  });

  it("house nodes render with glow flags", () => {
    const b = makeBloodline();
    mount(b);
    act(() => { store().addHouse(b.id, { x: 4500, y: 3800, name: "Casa Vellmor", isMainBranch: true, isMonarch: true }); });
    const house = screen.getByTestId("house-node");
    expect(house).toHaveClass("house-monarch");
    expect(house).toHaveClass("house-main");
  });

  it("person joined to a house shows the house name on the node", () => {
    const b = makeBloodline();
    const p = addPersonAt(b.id, 4000, 4000);
    const h = store().addHouse(b.id, { x: 4300, y: 3700, name: "Casa Vellmor" })!;
    act(() => { store().updatePerson(p.id, { houseId: h.id }); });
    mount(b);
    const node = screen.getByTestId("person-node");
    expect(node.textContent).toContain("Casa Vellmor");
  });

  it("house node shows its member count", () => {
    const b = makeBloodline();
    const h = store().addHouse(b.id, { x: 4300, y: 3700, name: "Casa Vellmor" })!;
    const p1 = addPersonAt(b.id, 4000, 4000);
    const p2 = addPersonAt(b.id, 4000, 4400, "Segundo");
    act(() => {
      store().updatePerson(p1.id, { houseId: h.id });
      store().updatePerson(p2.id, { houseId: h.id });
    });
    mount(b);
    const house = screen.getByTestId("house-node");
    expect(house.textContent).toContain("2 membros");
  });

  it("stacks canvas and panel below 720px", () => {
    const b = makeBloodline();
    mount(b);
    const wrapper = document.querySelector("[data-testid=bloodline-page] > div:nth-child(2)") as HTMLElement;
    expect(wrapper.className).toContain("max-[720px]:grid-cols-1");
  });

  it("house node drags and persists the position", () => {
    const b = makeBloodline();
    store().addHouse(b.id, { x: 4300, y: 3700, name: "Casa Vellmor" })!;
    mount(b);
    const house = screen.getByTestId("house-node");
    firePointer(house, "pointerdown", { clientX: 100, clientY: 100 });
    firePointer(document.body, "pointermove", { clientX: 160, clientY: 140 });
    firePointer(document.body, "pointerup", { clientX: 160, clientY: 140 });
    const got = store().bloodlines[0].houses[0];
    expect(got.x).not.toBe(4300);
    expect(got.y).not.toBe(3700);
  });
});
