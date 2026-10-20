import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { firePointer } from "../../test/pointer";
import { useScriptorium } from "../../data/store";
import { TimelineCanvasPage } from "./TimelineCanvasPage";

const store = () => useScriptorium.getState();
const timeline = () => store().timelines![0];

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1200 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 800 });

const renderPage = (tlId: string) => render(
  <MemoryRouter initialEntries={[`/p/prj_1/linewheel/${tlId}`]}>
    <Routes>
      <Route path="/p/:projectId/linewheel/:timelineId" element={<TimelineCanvasPage timelineId={tlId} />} />
      <Route path="/p/:projectId/entries" element={<div data-testid="codex-dest" />} />
      <Route path="/p/:projectId/calendar/:calendarId" element={<div data-testid="calendar-dest" />} />
    </Routes>
  </MemoryRouter>,
);

/** The single non-origin bead of a rendered wire. */
const eventBead = () => screen.getAllByTestId("tl-bead").find((el) => el.getAttribute("data-origin") === "false")!;

describe("TimelineCanvasPage", () => {
  it("panel sits beside the canvas after selecting an event", () => {
    const tl = store().addTimeline("prj_1", "Fio dos Selos");
    const b = store().addBead(tl.id, { x: 400, y: 140, label: "Guerra" })!;
    renderPage(tl.id);
    const bead = screen.getAllByTestId("tl-bead")[0];
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
    renderPage(tl.id);
    const panel = document.querySelector("[data-testid=tl-panel]") as HTMLElement;
    expect(panel.textContent).toMatch(/choose|pick/i);
  });

  it("Add event creates a bead right of the start and selects it", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    renderPage(tl.id);
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    const events = timeline().beads.filter((b) => !b.origin);
    expect(events).toHaveLength(1);
    expect(events[0].x).toBeGreaterThan(timeline().beads.find((b) => b.origin)!.x);
    const panel = document.querySelector("[data-testid=tl-panel]") as HTMLElement;
    expect(panel.textContent).not.toMatch(/choose|pick/i); // selected → editor fields
    expect(screen.getByLabelText("Event label")).toBeTruthy();
  });

  it("the start bead is pinned: it cannot be dragged or deleted", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    renderPage(tl.id);
    const origin = screen.getAllByTestId("tl-bead").find((el) => el.getAttribute("data-origin") === "true")!;
    firePointer(origin, "pointerdown", { clientX: 620, clientY: 300 });
    firePointer(document.querySelector("[data-testid=tl-canvas]")!, "pointermove", { clientX: 1000, clientY: 300 });
    expect(timeline().beads[0].x).toBe(0);
    const panel = document.querySelector("[data-testid=tl-panel]")!;
    expect(panel.textContent).toMatch(/start|início/i);
    expect(screen.queryByRole("button", { name: /delete|excluir/i })).toBeNull();
  });

  it("eras tile the wire: adjacent bands share an edge and never overlap", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    store().addEra(tl.id, 800, "Era do Selo");
    renderPage(tl.id);
    const bands = screen.getAllByTestId("tl-era");
    expect(bands).toHaveLength(2);
    const rects = bands.map((g) => g.querySelector("rect")!);
    const first = Number(rects[0].getAttribute("x")) + Number(rects[0].getAttribute("width"));
    const secondX = Number(rects[1].getAttribute("x"));
    expect(secondX).toBeCloseTo(first, 5);
    // no lane stacking any more: both bands sit on the wire
    expect(new Set(rects.map((r) => r.getAttribute("y")))).toEqual(new Set(["190"]));
  });

  it("eras are selectable and editable in the panel", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    store().addEra(tl.id, 800, "Era do Selo");
    renderPage(tl.id);
    const era = screen.getAllByTestId("tl-era").find((g) => g.textContent?.includes("Era do Selo"))!;
    firePointer(era, "pointerdown", { clientX: 200, clientY: 200 });
    const panel = document.querySelector("[data-testid=tl-panel]")!;
    expect(panel.textContent).toContain("Era do Selo");
    const name = screen.getByLabelText("Era name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Era da Prata" } });
    fireEvent.blur(name);
    expect(timeline().eras.find((e) => e.label === "Era da Prata")).toBeTruthy();
  });

  it("Add era splits the era under the view centre", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    renderPage(tl.id);
    fireEvent.click(screen.getByRole("button", { name: "Add era" }));
    expect(timeline().eras).toHaveLength(2);
    const era = timeline().eras[1];
    expect(era.startX).toBeGreaterThan(0); // at the view centre, not at the origin
    // the new era is selected so it can be named right away
    expect((screen.getByLabelText("Era name") as HTMLInputElement).value).toBe(era.label);
  });

  it("a narrow era hides its label but keeps the band", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    store().addEra(tl.id, 1040, "Guerra dos Cinco Invernos"); // wide band: 1040 → end of content
    const narrowEra = store().addEra(tl.id, 1016, "Golpe"); // narrow band: 1016 → 1040, the minimum 24px
    expect(narrowEra).toBeTruthy();
    renderPage(tl.id);
    const bands = screen.getAllByTestId("tl-era");
    const wide = bands.find((g) => g.textContent?.includes("Guerra dos Cinco Invernos"));
    expect(wide).toBeTruthy();
    expect(wide!.querySelector("text")).toBeTruthy();
    const narrow = bands.find((g) => g.querySelector("rect")?.getAttribute("x") === "1016");
    expect(narrow).toBeTruthy();
    expect(narrow!.querySelector("text")).toBeNull(); // band stays, name drops
  });

  it("an event can be marked as the start of a new era", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    const b = store().addBead(tl.id, { x: 900, label: "Guerra dos Cinco Invernos" })!;
    renderPage(tl.id);
    firePointer(screen.getAllByTestId("tl-bead").find((el) => el.getAttribute("data-bead-id") === b.id)!, "pointerdown", { clientX: 200, clientY: 200 });
    const toggle = screen.getByLabelText("Starts a new era") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
    const era = timeline().eras[1];
    expect(era.boundaryBeadId).toBe(b.id);
    expect(era.startX).toBe(900);
    fireEvent.click(screen.getByLabelText("Starts a new era"));
    expect(timeline().eras).toHaveLength(1); // merging back into the previous era
  });

  it("moving a boundary event moves the era edge with it", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    const b = store().addBead(tl.id, { x: 900, label: "Guerra" })!;
    const era = store().addEra(tl.id, 900, "Guerra")!;
    store().bindEraBoundary(era.id, b.id);
    renderPage(tl.id);
    const rect = () => screen.getAllByTestId("tl-era").find((g) => g.textContent?.includes("Guerra"))!.querySelector("rect")!;
    const before = Number(rect().getAttribute("x"));
    act(() => { store().moveBead(b.id, 1100, -40); });
    expect(Number(rect().getAttribute("x"))).toBeGreaterThan(before);
  });

  it("deleting an era leaves the previous one covering the span", () => {
    const tl = store().addTimeline("prj_1", "Fio");
    store().addEra(tl.id, 900, "Guerra");
    renderPage(tl.id);
    const band = screen.getAllByTestId("tl-era").find((g) => g.textContent?.includes("Guerra"))!;
    firePointer(band, "pointerdown", { clientX: 200, clientY: 200 });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(timeline().eras).toHaveLength(1);
  });

  it("a bead can point at a calendar event and open it", () => {
    const prj = store().addProject("V").id;
    const cal = store().addCalendar(prj, "Calendário do Selo");
    const ev = store().addCalendarEvent(cal.id, "0:2:5", { text: "Dia da Fundação", category: "Festivals" })!;
    const tl = store().addTimeline(prj, "Fio");
    const b = store().addBead(tl.id, { x: 800, y: 140, label: "Coroação" })!;
    renderPage(tl.id);
    firePointer(screen.getAllByTestId("tl-bead").find((el) => el.getAttribute("data-bead-id") === b.id)!, "pointerdown", { clientX: 200, clientY: 200 });
    fireEvent.change(screen.getByLabelText("Calendar event"), { target: { value: `${cal.id}|0:2:5|${ev.id}` } });
    expect(timeline().beads.find((x) => x.id === b.id)!.calendarEvent).toEqual({ calendarId: cal.id, dayKey: "0:2:5", eventId: ev.id });
    fireEvent.click(screen.getByRole("button", { name: "Open in calendar" }));
    expect(screen.getByTestId("calendar-dest")).toBeInTheDocument();
  });

  it("shows a removed calendar event as gone instead of crashing", () => {
    const prj = store().addProject("V").id;
    const tl = store().addTimeline(prj, "Fio");
    const b = store().addBead(tl.id, { x: 800, label: "Coroação" })!;
    store().updateBead(b.id, { calendarEvent: { calendarId: "cal_x", dayKey: "0:1:1", eventId: "ce_gone" } });
    renderPage(tl.id);
    firePointer(screen.getAllByTestId("tl-bead").find((el) => el.getAttribute("data-bead-id") === b.id)!, "pointerdown", { clientX: 200, clientY: 200 });
    expect(document.querySelector("[data-testid=tl-panel]")!.textContent).toMatch(/no longer exists/i);
  });

  it("a bead bound to a tome entry previews it and opens the codex", () => {
    const prj = store().addProject("V").id;
    const entry = store().addEntry(prj, "event");
    store().updateEntry(entry.id, { title: "Guerra dos Cinco Invernos", summary: "O rio ficou vermelho." });
    const tl = store().addTimeline(prj, "Fio dos Selos");
    const bead = store().addBead(tl.id, { x: 800, y: 140, label: "Guerra" })!;
    store().updateBead(bead.id, { entryId: entry.id });
    renderPage(tl.id);
    firePointer(eventBead(), "pointerdown", { clientX: 300, clientY: 200 });
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
    renderPage(tl.id);
    fireEvent.doubleClick(eventBead());
    expect(screen.getByTestId("codex-dest")).toBeInTheDocument();
  });

  it("double-clicking an unlinked bead does nothing", () => {
    const prj = store().addProject("V").id;
    const tl = store().addTimeline(prj, "Fio");
    store().addBead(tl.id, { x: 800, y: 140, label: "Marcas" });
    renderPage(tl.id);
    fireEvent.doubleClick(eventBead());
    expect(screen.queryByTestId("codex-dest")).toBeNull();
  });

  it("groups take pointer events (svg layer must not swallow real clicks)", () => {
    const prj = store().addProject("V").id;
    const tl = store().addTimeline(prj, "Fio");
    store().addBead(tl.id, { x: 620, y: -40, label: "A" });
    renderPage(tl.id);
    const svg = document.querySelector("[data-testid=tl-wire-svg]") as SVGSVGElement;
    expect(svg.getAttribute("class")).toContain("overflow-visible");
    expect(svg.getAttribute("class")).toContain("[&_.tl-bead]:pointer-events-auto");
    expect(svg.getAttribute("class")).toContain("[&_.tl-era]:pointer-events-auto");
  });

  it("fits content on mount so beads above the wire are on-screen", () => {
    const prj = store().addProject("V").id;
    const tl = store().addTimeline(prj, "Fio");
    // seed shape: beads above (negative y) and below the wire at y=200
    store().addBead(tl.id, { x: 620, y: -40, label: "A" });
    store().addBead(tl.id, { x: 1580, y: 40, label: "B" });
    store().addEra(tl.id, 1080, "Era");
    renderPage(tl.id);
    const plane = document.querySelector("[data-testid=tl-plane]") as HTMLElement;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(plane.style.transform)!;
    const panX = Number(m[1]), panY = Number(m[2]), s = Number(m[3]);
    const dots = Array.from(document.querySelectorAll<SVGCircleElement>(".tl-bead-dot"));
    expect(dots.length).toBe(3);
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
    // the readout tracks the transform the fit computed
    expect(screen.getByTestId("tlc-zoom").textContent).toBe(`${Math.round(s * 100)}%`);
  });
});
