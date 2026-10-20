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
    expect(panel.textContent).toMatch(/choose|pick/i);
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
    expect(panel.textContent).not.toMatch(/choose|pick/i); // selected → editor fields
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

  it("overlapping eras render on separate lanes and both stay selectable", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    store().addSegment(tl.id, 1000, 3000, "Primeira Era");
    store().addSegment(tl.id, 1800, 3600, "Segunda Era");
    render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} /></MemoryRouter>);
    const segs = screen.getAllByTestId("tl-seg");
    expect(segs).toHaveLength(2);
    const ys = segs.map((g) => g.querySelector("line")!.getAttribute("y1"));
    expect(new Set(ys).size).toBe(2);
    const second = segs.find((g) => g.textContent?.includes("Segunda Era"))!;
    firePointer(second, "pointerdown", { clientX: 200, clientY: 200 });
    expect(document.querySelector("[data-testid=tl-panel]")!.textContent).toContain("Segunda Era");
    const first = segs.find((g) => g.textContent?.includes("Primeira Era"))!;
    firePointer(first, "pointerdown", { clientX: 200, clientY: 200 });
    expect(document.querySelector("[data-testid=tl-panel]")!.textContent).toContain("Primeira Era");
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

  it("double-clicking a linked bead opens the codex entry", () => {
    const prj = store().addProject("V").id;
    const entry = store().addEntry(prj, "event");
    store().updateEntry(entry.id, { title: "Guerra dos Cinco Invernos" });
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
    fireEvent.doubleClick(screen.getByTestId("tl-bead"));
    expect(screen.getByTestId("codex-dest")).toBeInTheDocument();
  });

  it("double-clicking an unlinked bead does nothing", () => {
    const prj = store().addProject("V").id;
    const tl = store().addTimeline(prj, "Fio");
    store().addBead(tl.id, { x: 800, y: 140, label: "Marcas" });
    render(
      <MemoryRouter initialEntries={[`/p/${prj}/linewheel/${tl.id}`]}>
        <Routes>
          <Route path="/p/:projectId/linewheel/:timelineId" element={<TimelineCanvasPage timelineId={tl.id} />} />
          <Route path="/p/:projectId/entries" element={<div data-testid="codex-dest" />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.doubleClick(screen.getByTestId("tl-bead"));
    expect(screen.queryByTestId("codex-dest")).toBeNull();
  });

  it("bead groups take pointer events (svg layer must not swallow real clicks)", () => {
    const prj = store().addProject("V").id;
    const tl = store().addTimeline(prj, "Fio");
    store().addBead(tl.id, { x: 620, y: -40, label: "A" });
    render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} /></MemoryRouter>);
    const svg = document.querySelector("[data-testid=tl-wire-svg]") as SVGSVGElement;
    expect(svg.getAttribute("class")).toContain("overflow-visible");
    expect(svg.getAttribute("class")).toContain("[&_.tl-bead]:pointer-events-auto");
    expect(svg.getAttribute("class")).toContain("[&_.tl-seg]:pointer-events-auto");
  });

  it("fits content on mount so beads above the wire are on-screen", () => {
    const prj = store().addProject("V").id;
    const tl = store().addTimeline(prj, "Fio");
    // seed shape: beads above (negative y) and below the wire at y=200
    store().addBead(tl.id, { x: 620, y: -40, label: "A" });
    store().addBead(tl.id, { x: 1580, y: 40, label: "B" });
    store().addSegment(tl.id, 1080, 1260, "Era");
    render(<MemoryRouter><TimelineCanvasPage timelineId={tl.id} /></MemoryRouter>);
    const plane = document.querySelector("[data-testid=tl-plane]") as HTMLElement;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(plane.style.transform)!;
    const panX = Number(m[1]), panY = Number(m[2]), s = Number(m[3]);
    const dots = Array.from(document.querySelectorAll<SVGCircleElement>(".tl-bead-dot"));
    expect(dots.length).toBe(2);
    for (const dot of dots) {
      const g = dot.closest("[data-testid=tl-bead]")!;
      const gm = /translate\(([-\d.]+), ([-\d.]+)\)/.exec(g.getAttribute("transform")!)!;
      const sx = panX + Number(gm[1]) * s;
      const sy = panY + Number(gm[2]) * s;
      expect(sx).toBeGreaterThanOrEqual(0);
      expect(sx).toBeLessThanOrEqual(1200);
      expect(sy).toBeGreaterThanOrEqual(0);
      expect(sy).toBeLessThanOrEqual(800);
    }
    expect(screen.getByTestId("tlc-zoom").textContent).toBe("100%");
  });
});
