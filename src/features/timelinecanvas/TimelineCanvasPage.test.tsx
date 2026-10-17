import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { firePointer } from "../../test/pointer";
import { useScriptorium } from "../../data/store";
import { TimelineCanvasPage } from "./TimelineCanvasPage";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1200 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 800 });

describe("TimelineCanvasPage", () => {
  it("panel sits beside the canvas after selecting a bead", () => {
    const tl = store().addTimeline("prj_1", "Fio dos Selos");
    const b = store().addBead(tl.id, { x: 400, y: 140, label: "Guerra" })!;
    render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} /></MemoryRouter>);
    const bead = screen.getByTestId("tl-bead");
    firePointer(bead, "pointerdown", { clientX: 420, clientY: 180 });
    const panel = document.querySelector("[data-testid=tl-panel]") as HTMLElement;
    expect(panel).toBeTruthy();
    // editor beside the canvas, never painted behind the plane
    expect(panel.closest("[data-testid=tl-canvas]")).toBeNull();
    expect(panel.parentElement?.className).toContain("bl-body");
    void b;
  });

  it("panel shows a hint with no selection", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} /></MemoryRouter>);
    const panel = document.querySelector("[data-testid=tl-panel]") as HTMLElement;
    expect(panel.textContent).toMatch(/choose|escolha/i);
  });
});