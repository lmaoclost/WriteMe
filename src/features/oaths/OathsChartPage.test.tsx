import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useScriptorium } from "../../data/store";
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
    expect(panel.parentElement?.className).toContain("bl-body");
    void a;
  });

  it("panel shows a hint with no selection", () => {
    const ch = store().addOathsChart("prj_1", "Anel");
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    const panel = document.querySelector("[data-testid=oaths-panel]") as HTMLElement;
    expect(panel.textContent).toMatch(/pick a member/i);
  });

  it("subordinating an existing member creates a link, not a new member", () => {
    const ch = store().addOathsChart("prj_1", "Anel");
    const a = store().addOathMember(ch.id, undefined, { name: "Mirren" })!;
    const b = store().addOathMember(ch.id, undefined, { name: "Orvean" })!;
    render(<MemoryRouter><OathsChartPage chartId={ch.id} /></MemoryRouter>);
    fireEvent.click(screen.getByLabelText("Membro Mirren"));
    const beforeMembers = store().oathsCharts![0].members.length;
    const pick = screen.getByLabelText("Subordinar a") as HTMLSelectElement;
    fireEvent.change(pick, { target: { value: b.id } });
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
});

describe("OathsIndexPage", () => {
  it("index creates + deletes a chart", () => {
    store().addOathsChart("prj_1", "Anel");
    render(<MemoryRouter><OathsIndexPage projectId="prj_1" /></MemoryRouter>);
    expect(screen.getByText("Anel")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Delete oaths hierarchy"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().oathsCharts).toHaveLength(0);
  });
});
