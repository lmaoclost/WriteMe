import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { firePointer } from "../../test/pointer";
import { useScriptorium } from "../../data/store";
import { PlotBoardPage } from "./PlotBoardPage";

import { PlotBoardIndexPage } from "./PlotBoardIndexPage";
import type { PlotBoard } from "../../domain/types";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1200 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 800 });

function seedBoard(): PlotBoard {
  return store().addPlotBoard("prj_1", "A Guerra");
}

describe("PlotBoardPage", () => {
  it("panel sits beside the canvas after selecting a scene", () => {
    const b = seedBoard();
    const c = store().addCard(b.id, { x: 200, y: 140 })!;
    render(<PlotBoardPage boardId={b.id} />);
    const node = screen.getByTestId("board-card");
    firePointer(node, "pointerdown", { clientX: 210, clientY: 150 });
    const panel = document.querySelector("[data-testid=pb-panel]") as HTMLElement;
    expect(panel).toBeTruthy();
    // editor beside the canvas, never inside the plane-covered container
    expect(panel.closest("[data-testid=pb-canvas]")).toBeNull();
    expect(panel.parentElement?.className).toContain("grid-cols-[1fr_300px]");
    void c;
  });
  it("empty state invites the first scene", () => {
    const b = seedBoard();
    render(<PlotBoardPage boardId={b.id} />);
    expect(screen.getByText(/drag to pan/i)).toBeInTheDocument();
  });

  it("empty-canvas drag pans the view instead of creating a scene", () => {
    const b = seedBoard();
    store().addCard(b.id, { x: 4000, y: 4000 });
    render(<PlotBoardPage boardId={b.id} />);
    const canvas = screen.getByTestId("pb-canvas");
    const before = canvas.querySelector("[data-testid=\"pb-plane\"]")!.getAttribute("style")!;
    firePointer(canvas, "pointerdown", { clientX: 500, clientY: 400 });
    firePointer(canvas, "pointermove", { clientX: 380, clientY: 350 });
    firePointer(canvas, "pointerup", { clientX: 380, clientY: 350 });
    const after = canvas.querySelector("[data-testid=\"pb-plane\"]")!.getAttribute("style")!;
    expect(after).not.toBe(before);
    expect(after).toContain("scale(0.5)");
    expect(store().plotBoards![0].cards).toHaveLength(1);
  });

  it("empty-canvas click without move creates nothing", () => {
    const b = seedBoard();
    render(<PlotBoardPage boardId={b.id} />);
    const canvas = screen.getByTestId("pb-canvas");
    firePointer(canvas, "pointerdown", { clientX: 240, clientY: 140 });
    firePointer(canvas, "pointerup", { clientX: 240, clientY: 140 });
    expect(store().plotBoards![0].cards).toHaveLength(0);
  });

  it("header + Add scene creates a card at the view center and selects it", () => {
    const b = seedBoard();
    render(<PlotBoardPage boardId={b.id} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add scene" }));
    const cards = store().plotBoards![0].cards;
    expect(cards).toHaveLength(1);
    // view default s=0.5, pan 60/20, canvas stub 1200x800 → center (1080, 760)
    expect(cards[0].x).toBe(1080);
    expect(cards[0].y).toBe(760);
    const panel = document.querySelector("[data-testid=pb-panel]") as HTMLElement;
    expect(panel.textContent).toContain("Scene");
  });

  it("placing a card by canvas click + selecting by node pointerdown", () => {
    const b = seedBoard();
    const c = store().addCard(b.id, { x: 300, y: 200 })!;
    render(<PlotBoardPage boardId={b.id} />);
    const card = document.querySelector('[data-testid="board-card"]') as HTMLElement;
    firePointer(card, "pointerdown", { clientX: 310, clientY: 210 });
    expect(c.x).toBe(300);
    const panel = document.querySelector("[data-testid=pb-panel]") as HTMLElement;
    expect(panel).toBeTruthy();
  });

  it("card drag moves with history push", () => {
    const b = seedBoard();
    const c = store().addCard(b.id, { x: 4000, y: 4000 })!;
    render(<PlotBoardPage boardId={b.id} />);
    const node = screen.getByTestId("board-card");
    firePointer(node, "pointerdown", { clientX: 100, clientY: 100 });
    firePointer(node, "pointermove", { clientX: 150, clientY: 100 });
    firePointer(node, "pointerup", { clientX: 150, clientY: 100 });
    const moved = store().plotBoards![0].cards.find((x) => x.id === c.id)!;
    expect(moved.x).toBe(4100); // view scale 0.5: 50 screen px = 100 canvas px
    act(() => { store().undoPB(b.id); });
    expect(store().plotBoards![0].cards[0].x).toBe(4000);
  });

  it("wire flow: handle → target → wire exists; wire click removes", () => {
    const b = seedBoard();
    const a = store().addCard(b.id, { x: 3000, y: 3000 })!;
    const c = store().addCard(b.id, { x: 3000, y: 3600 })!;
    render(<PlotBoardPage boardId={b.id} />);
    const nodeA = screen.getAllByTestId("board-card").find((n) => n.getAttribute("data-card-id") === a.id)!;
    firePointer(nodeA.querySelector(".conn-btn") as HTMLElement, "pointerdown", { clientX: 0, clientY: 0 });
    expect(screen.getByText(/scene card to connect/i)).toBeInTheDocument();
    const nodeB = screen.getAllByTestId("board-card").find((n) => n.getAttribute("data-card-id") === c.id)!;
    firePointer(nodeB, "pointerdown", { clientX: 0, clientY: 0 });
    expect(store().plotBoards![0].wires).toHaveLength(1);
    const wire = document.querySelector(".plot-wire-hit") as HTMLElement;
    wire.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(store().plotBoards![0].wires).toHaveLength(0);
  });

  it("panel edits title/pov/location/color/parts", () => {
    const b = seedBoard();
    const c = store().addCard(b.id)!;
    render(<PlotBoardPage boardId={b.id} />);
    const node = screen.getByTestId("board-card");
    firePointer(node, "pointerdown", { clientX: 0, clientY: 0 });
    const title = screen.getByLabelText("Scene title") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "A chegada" } });
    fireEvent.blur(title);
    expect(store().plotBoards![0].cards.find((x) => x.id === c.id)!.title).toBe("A chegada");
    fireEvent.click(screen.getByRole("button", { name: "Add beat" }));
    const beat = screen.getByLabelText("Beat 1") as HTMLInputElement;
    fireEvent.change(beat, { target: { value: "o rio avisa" } });
    fireEvent.blur(beat);
    expect(store().plotBoards![0].cards[0].parts[0].text).toBe("o rio avisa");
  });

  it("notepad persists", () => {
    vi.useFakeTimers();
    const b = seedBoard();
    render(<PlotBoardPage boardId={b.id} />);
    fireEvent.click(screen.getByRole("button", { name: /notes/i }));
    fireEvent.change(screen.getByLabelText("Board notes"), { target: { value: "O fio do selo quebra no ato 2." } });
    act(() => vi.advanceTimersByTime(320));
    expect(store().plotBoards![0].notes).toBe("O fio do selo quebra no ato 2.");
    vi.useRealTimers();
  });

  it("undo/redo flags", () => {
    const b = seedBoard();
    act(() => { store().addCard(b.id); });
    render(<PlotBoardPage boardId={b.id} />);
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(false);
    act(() => { store().undoPB(b.id); });
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("PlotBoardIndexPage", () => {
  it("index renders, creates, deletes", () => {
    seedBoard();
    render(<MemoryRouter><PlotBoardIndexPage projectId="prj_1" /></MemoryRouter>);
    expect(screen.getByText("A Guerra")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Delete plot board"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().plotBoards).toHaveLength(0);
  });
});
