import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { selectOption } from "../../test/selectHelper";
import { firePointer } from "../../test/pointer";
import { OathsChartPage } from "./OathsChartPage";
import { OathsIndexPage } from "./OathsIndexPage";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1200 });
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 800 });

describe("OathsChartPage", () => {
  it("panel sits beside the canvas after selecting a member", () => {
    const ch = store().addOathsChart("prj_1", "Anel de Lealdade");
    const a = store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId("oath-member"));
    const panel = document.querySelector("[data-testid=oaths-panel]") as HTMLElement;
    expect(panel).toBeTruthy();
    // editor beside the canvas, never painted behind the plane
    expect(panel.closest("[data-testid=oaths-canvas]")).toBeNull();
    expect(panel.parentElement?.className).toContain("grid-cols-[1fr_300px]");
    void a;
  });

  it("panel shows a hint with no selection", () => {
    const ch = store().addOathsChart("prj_1", "Anel");
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    const panel = document.querySelector("[data-testid=oaths-panel]") as HTMLElement;
    expect(panel.textContent).toMatch(/pick a member/i);
  });

  it("subordinating an existing member creates a link, not a new member", async () => {
    const ch = store().addOathsChart("prj_1", "Anel");
    const a = store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
    const b = store().addOathMember(ch.id, undefined, { name: "Orvean" })!;
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    fireEvent.click(screen.getByLabelText("Member Mirren"));
    const beforeMembers = store().oathsCharts![0].members.length;
    await selectOption(() => screen.getByLabelText("Subordinate to"), "Orvean");
    const chart = store().oathsCharts![0];
    expect(chart.members).toHaveLength(beforeMembers); // no phantom member
    const link = chart.oathLinks.find((l) => l.subordinateId === a.id);
    expect(link).toBeTruthy();
    expect(link!.superiorId).toBe(b.id);
    expect(link!.status).toBe("sworn");
    // and the link can be removed from the row
    fireEvent.click(screen.getByLabelText("Remove oath link"));
    expect(store().oathsCharts![0].oathLinks.find((l) => l.subordinateId === a.id)).toBeFalsy();
  });

  it("member position is stored on drag", () => {
    const ch = store().addOathsChart("prj_1", "Anel");
    store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    const card = screen.getByTestId("oath-member");
    const canvas = screen.getByTestId("oaths-canvas");
    firePointer(card, "pointerdown", { clientX: 100, clientY: 100 });
    firePointer(canvas, "pointermove", { clientX: 200, clientY: 150 });
    firePointer(canvas, "pointerup", { clientX: 200, clientY: 150 });
    const got = store().oathsCharts![0].members[0];
    expect(got.x).not.toBeUndefined();
    expect(got.y).not.toBeUndefined();
  });

  it("zoom out button updates the zoom % readout", () => {
    const ch = store().addOathsChart("prj_1", "Anel");
    store().addOathMember(ch.id, undefined, { name: "Mirren" });
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    fireEvent.click(screen.getByLabelText("Zoom out"));
    expect(screen.getByTestId("oc-zoom").textContent).toBe("80%"); // fit inicial = 100%, 1 × 0.8
  });

  it("clicking the handle then another member creates an oath link", () => {
    const ch = store().addOathsChart("prj_1", "Anel");
    const a = store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
    const b = store().addOathMember(ch.id, undefined, { name: "Orvean" })!;
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    firePointer(screen.getByLabelText(`Connect ${a.name}`), "pointerdown", { clientX: 300, clientY: 300 });
    const target = document.querySelector(`[data-member-id="${b.id}"]`) as HTMLElement;
    firePointer(target, "pointerdown", { clientX: 500, clientY: 400 });
    const chart = store().oathsCharts![0];
    expect(chart.oathLinks.find((l) => l.superiorId === a.id && l.subordinateId === b.id)).toBeTruthy();
  });

  it("pending rubber band lands on the pointer in plane coords", () => {
    const ch = store().addOathsChart("prj_1", "Anel");
    const a = store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
    void a;
    store().addOathMember(ch.id, undefined, { name: "Orvean" });
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    firePointer(screen.getByLabelText("Connect Mirren"), "pointerdown", { clientX: 300, clientY: 300 });
    firePointer(screen.getByTestId("oaths-canvas"), "pointermove", { clientX: 500, clientY: 450 });
    // fit: 2 roots at x=315/465 → s=1, panX=600-390=210, panY=400-120=280
    // cursor (500,450) stage-relative → plane (290, 170)
    const line = document.querySelector('[data-testid="pending-oath"]') as SVGLineElement;
    expect(line.getAttribute("x2")).toBe("290");
    expect(line.getAttribute("y2")).toBe("170");
  });

  it("drag releases anywhere (window-level), not only over the canvas", () => {
    const ch = store().addOathsChart("prj_1", "Anel");
    store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    firePointer(screen.getByTestId("oath-member"), "pointerdown", { clientX: 100, clientY: 100 });
    firePointer(document.body, "pointermove", { clientX: 200, clientY: 150 });
    firePointer(document.body, "pointerup", { clientX: 200, clientY: 150 });
    const got = store().oathsCharts![0].members[0];
    expect(got.x).not.toBeUndefined();
    expect(got.y).not.toBeUndefined();
  });
});

describe("OathsIndexPage", () => {
  it("index creates + deletes a chart", () => {
    store().addOathsChart("prj_1", "Anel");
    render(<MemoryRouter><OathsIndexPage projectId="prj_1" /></MemoryRouter>);
    expect(screen.getByText("Anel")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Delete oath chart"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().oathsCharts).toHaveLength(0);
  });
});
