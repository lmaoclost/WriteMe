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
    expect(screen.getByText(/Comece pela linhagem/i)).toBeInTheDocument();
  });

  it("creates a bloodline via modal", async () => {
    render(<MemoryRouter><BloodlineIndexPage projectId="prj_1" /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Nova linhagem" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Vellmor" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(store().bloodlines.map((b) => b.name)).toEqual(["Vellmor"]);
  });

  it("shows cards with counts and links to the canvas", () => {
    const b = makeBloodline();
    addPersonAt(b.id, 4000, 4000);
    render(<MemoryRouter><BloodlineIndexPage projectId="prj_1" /></MemoryRouter>);
    expect(screen.getByText("Vellmor")).toBeInTheDocument();
    expect(screen.getByText(/1 pessoa/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vellmor/ })).toHaveAttribute("href", `/p/prj_1/bloodline/${b.id}`);
  });

  it("deletes two-step", () => {
    const b = makeBloodline();
    void b;
    render(<MemoryRouter><BloodlineIndexPage projectId="prj_1" /></MemoryRouter>);
    fireEvent.click(screen.getByTitle("Excluir linhagem"));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
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
    const b = makeBloodline();
    const p = addPersonAt(b.id, 4000, 4000);
    mount(b);
    const node = screen.getByTestId("person-node");
    firePointer(node, "pointerdown", { clientX: 100, clientY: 100 });
    firePointer(node, "pointermove", { clientX: 140, clientY: 100 });
    firePointer(node, "pointerup", { clientX: 140, clientY: 100 });
    const moved = store().bloodlines[0].persons.find((x) => x.id === p.id)!;
    // plane starts at scale 0.1 (20k canvas in a 800×600 viewport): 40 screen
    // px drag = 400 canvas px.
    expect(moved.x).toBe(4400);
    // undo restores
    act(() => { store().undoBL(b.id); });
    expect(store().bloodlines[0].persons.find((x) => x.id === p.id)!.x).toBe(4000);
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
});
