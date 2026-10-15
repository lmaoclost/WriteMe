import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { firePointer } from "../../test/pointer";
import { useScriptorium } from "../../data/store";
import { WellSpringPage } from "./WellSpringPage";
import { WellSpringIndexPage } from "./WellSpringIndexPage";
import type { WellSpring } from "../../domain/types";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1200 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 800 });

function seed(): WellSpring {
  return store().addWellSpring("prj_1", "A Guerra do Selo");
}

describe("store — wellspring", () => {
  it("addWellNode kinds + border dup/self guards + delete cleans borders", () => {
    const w = seed();
    const a = store().addWellNode(w.id, { kind: "character", x: 100, y: 100, text: "Aerith" })!;
    const b = store().addWellNode(w.id, { kind: "conflict", x: 400, y: 300, text: "O rio secou" })!;
    expect(store().addWellBorder(w.id, a.id, a.id, "self")).toBeNull();
    act(() => { store().addWellBorder(w.id, a.id, b.id, "vive o conflito"); });
    expect(store().addWellBorder(w.id, b.id, a.id, "dup")).toBeNull();
    act(() => { store().deleteWellNode(b.id); });
    const after = store().wellsprings![0];
    expect(after.borders).toHaveLength(0);
    expect(after.nodes.map((n) => n.id)).toEqual([a.id]);
  });

  it("border label edit + remove", () => {
    const w = seed();
    const a = store().addWellNode(w.id, { kind: "question", x: 0, y: 0, text: "Quem mente?" })!;
    const b = store().addWellNode(w.id, { kind: "setting", x: 200, y: 200, text: "As margens" })!;
    act(() => { store().addWellBorder(w.id, a.id, b.id, "primeira fronteira"); });
    act(() => { store().updateWellBorder(store().wellsprings![0].borders[0].id, "reescrita"); });
    expect(store().wellsprings![0].borders[0].label).toBe("reescrita");
    act(() => { store().removeWellBorder(store().wellsprings![0].borders[0].id); });
    expect(store().wellsprings![0].borders).toHaveLength(0);
    void a; void b;
  });
});

describe("WellSpringPage", () => {
  it("placing nodes by kind, moving them, panel edits text", () => {
    const w = seed();
    render(<WellSpringPage wellId={w.id} />);
    fireEvent.click(screen.getByRole("button", { name: "⚔ Conflito" }));
    const canvas = screen.getByTestId("well-canvas");
    firePointer(canvas, "pointerdown", { clientX: 300, clientY: 200 });
    const node = screen.getByTestId("well-node");
    expect(node.textContent).toContain("Conflito");
    // drag
    firePointer(node, "pointerdown", { clientX: 300, clientY: 200 });
    firePointer(node, "pointermove", { clientX: 360, clientY: 260 });
    firePointer(node, "pointerup", { clientX: 360, clientY: 260 });
    const moved = store().wellsprings![0].nodes[0];
    // created at canvas (220,160), dragged +60 screen px at scale 1 → (280,220)
    expect(moved.x).toBe(280);
    expect(moved.y).toBe(220);
    // text via panel
    renderText();
    expect(store().wellsprings![0].nodes[0].text).toBe("O rio virou sangue");
  });

  it("border add via panel with label then remove by wire click", () => {
    const w = seed();
    act(() => {
      store().addWellNode(w.id, { kind: "character", x: 100, y: 100, text: "Aerith" });
      store().addWellNode(w.id, { kind: "question", x: 420, y: 220, text: "Por que o rio fala?" });
    });
    render(<WellSpringPage wellId={w.id} />);
    const node = screen.getAllByTestId("well-node").find((n) => n.getAttribute("data-node-id") === store().wellsprings![0].nodes[0].id)!;
    firePointer(node, "pointerdown", { clientX: 0, clientY: 0 });
    fireEvent.change(screen.getByLabelText("Destino da borda"), { target: { value: store().wellsprings![0].nodes[1].id } });
    fireEvent.change(screen.getByLabelText("Label da nova borda"), { target: { value: "ouviu o aviso" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Borda" }));
    expect(screen.getByText("ouviu o aviso")).toBeInTheDocument();
    const borderRow = screen.getAllByLabelText("Label da borda com Por que o rio fala?")[0] as HTMLInputElement;
    fireEvent.change(borderRow, { target: { value: "rascunho" } });
    expect(store().wellsprings![0].borders[0].label).toBe("rascunho");
  });
});

function renderText() {
  const inp = document.querySelector('[data-testid="well-panel"] input[aria-label="Texto do nó"]') as HTMLInputElement | null;
  if (!inp) return;
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setValue?.call(inp, "O rio virou sangue");
  inp.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("WellSpringIndexPage", () => {
  it("index creates + deletes", () => {
    seed();
    render(<MemoryRouter><WellSpringIndexPage projectId="prj_1" /></MemoryRouter>);
    expect(screen.getByText("A Guerra do Selo")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Delete wellspring"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().wellsprings).toHaveLength(0);
  });
});
