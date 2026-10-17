import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
    expect(panel.parentElement?.className).toContain("grid-cols-[1fr_300px]");
    void b;
  });

  it("panel shows a hint with no selection", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} /></MemoryRouter>);
    const panel = document.querySelector("[data-testid=tl-panel]") as HTMLElement;
    expect(panel.textContent).toMatch(/choose|escolha/i);
  });

  it("Add event creates a bead at the visible center and selects it", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    const beads = store().timelines![0].beads;
    expect(beads).toHaveLength(1);
    // default view s=0.4, pan 100/0, canvas stub 1200x800 → center x=(600−100)/0.4=1250, acima do fio (y=−60)
    expect(beads[0].x).toBe(1250);
    expect(beads[0].y).toBe(-60);
    const panel = document.querySelector("[data-testid=tl-panel]") as HTMLElement;
    expect(panel.textContent).not.toMatch(/choose|escolha/i); // selected → editor fields
    expect(screen.getByLabelText("Event label")).toBeTruthy();
  });

  it("segments are selectable and editable", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    store().addSegment(tl.id, 1000, 3000, "Era do Selo");
    render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} /></MemoryRouter>);
    const seg = screen.getByTestId("tl-seg");
    firePointer(seg, "pointerdown", { clientX: 200, clientY: 200 });
    const panel = document.querySelector("[data-testid=tl-panel]") as HTMLElement;
    expect(panel.textContent).toContain("Era do Selo");
    const name = screen.getByLabelText("Segment name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Era da Prata" } });
    fireEvent.blur(name);
    expect(store().timelines![0].segments[0].label).toBe("Era da Prata");
  });

  it("a bead bound to a tome entry previews it and opens the codex", () => {
    const prj = store().addProject("V").id;
    const entry = store().addEntry(prj, "event");
    store().updateEntry(entry.id, { title: "Guerra dos Cinco Invernos", summary: "O rio ficou vermelho." });
    const tl = store().addTimeline(prj, "Fio dos Selos");
    const bead = store().addBead(tl.id, { x: 800, y: 140, label: "Guerra" })!;
    store().updateBead(bead.id, { entryId: entry.id });
    render(
      <MemoryRouter initialEntries={[`/p/${prj}/linewheel/${tl.id}`]}>
        <Routes>
          <Route path="/p/:projectId/linewheel/:timelineId" element={<TimelineCanvasPage timelineId={tl.id} />} />
          <Route path="/p/:projectId/entries" element={<div data-testid="codex-dest" />} />
        </Routes>
      </MemoryRouter>,
    );
    firePointer(screen.getByTestId("tl-bead"), "pointerdown", { clientX: 300, clientY: 200 });
    const panel = document.querySelector("[data-testid=tl-panel]")!;
    expect(panel.textContent).toContain("Guerra dos Cinco Invernos");
    expect(panel.textContent).toContain("O rio ficou vermelho."); // blurb preview
    fireEvent.click(screen.getByRole("button", { name: "Open in codex" }));
    expect(screen.getByTestId("codex-dest")).toBeInTheDocument();
  });
});
