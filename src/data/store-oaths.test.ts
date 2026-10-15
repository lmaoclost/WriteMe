import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { parseExport, validateProjectData } from "./schema";
import { useScriptorium } from "./store";
import { tidyOathsChart } from "../domain/oaths";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

const seed = () => {
  const chart = store().addOathsChart("prj_1", "Coroa");
  const root = store().addOathMember(chart.id, undefined, { name: "Aldric" })!;
  const child = store().addOathMember(chart.id, root.id, { name: "Kael" })!;
  const grand = store().addOathMember(chart.id, child.id, { name: "Mira" })!;
  return { chart, root, child, grand };
};

describe("tidyOathsChart", () => {
  it("leaf chain centers children under superiors", () => {
    seed();
    const chart = store().oathsCharts![0];
    const pos = tidyOathsChart(chart.members, chart.oathLinks, { rootX: 300, rootY: 100 });
    const root = pos.get(chart.members[0].id)!;
    const child = pos.get(chart.members[1].id)!;
    const grand = pos.get(chart.members[2].id)!;
    expect(root.y).toBe(100);
    expect(child.y).toBe(260);
    expect(grand.y).toBe(420);
    expect(root.x).toBe(child.x);
    expect(grand.x).toBe(child.x); // single leaf chain: shared center x
  });
  it("two children spread around the parent", () => {
    const { root } = seed();
    act(() => { store().addOathMember(store().oathsCharts![0].id, root.id, { name: "Terceiro" }); });
    const chart = store().oathsCharts![0];
    const pos = tidyOathsChart(chart.members, chart.oathLinks, { rootX: 300, rootY: 100 });
    const rootX = pos.get(chart.members[0].id)!.x;
    const kids = pos.get(chart.members[1].id)!.x;
    const third = pos.get(chart.members[3].id)!.x;
    expect(kids).toBeLessThan(rootX);
    expect(third).toBeGreaterThan(rootX);
  });
  it("cycles do not hang (fallback keeps first member)", () => {
    const members = [
      { id: "a", name: "A", seatStatus: "held" as const, color: "#fff" },
      { id: "b", name: "B", seatStatus: "held" as const, color: "#fff" },
    ];
    const links = [
      { id: "l1", subordinateId: "a", superiorId: "b", kind: "primary" as const, status: "sworn" as const },
      { id: "l2", subordinateId: "b", superiorId: "a", kind: "primary" as const, status: "sworn" as const },
    ];
    const pos = tidyOathsChart(members as never, links as never);
    expect(pos.size).toBe(2);
  });
});

describe("store — oaths", () => {
  it("addOathMember creates sworn primary link; undo removes member+link", () => {
    const { chart, root } = seed();
    const newMember = store().addOathMember(chart.id, root.id, { name: "Novo" })!;
    const l = store().oathsCharts![0].oathLinks.find((x) => x.subordinateId === newMember.id)!;
    expect(l.status).toBe("sworn");
    expect(l.kind).toBe("primary");
    act(() => { store().undoOC(chart.id); });
    const after = store().oathsCharts![0];
    expect(after.oathLinks.some((x) => x.subordinateId === newMember.id)).toBe(false);
    expect(after.members.some((m) => m.id === newMember.id)).toBe(false);
    void root;
  });

  it("deleteOathMember removes the whole sworn subtree", () => {
    const { chart, root } = seed();
    act(() => { store().deleteOathMember(root.id); });
    const after = store().oathsCharts![0];
    expect(after.members).toHaveLength(0);
    expect(after.oathLinks).toHaveLength(0);
    act(() => { store().undoOC(chart.id); });
    expect(store().oathsCharts![0].members).toHaveLength(3);
  });

  it("setOathStatus cycles statuses", () => {
    const { chart } = seed();
    const link = store().oathsCharts![0].oathLinks[0];
    act(() => { store().setOathStatus(link.id, "strained"); });
    expect(store().oathsCharts![0].oathLinks[0].status).toBe("strained");
    act(() => { store().setOathStatus(link.id, "broken"); });
    expect(store().oathsCharts![0].oathLinks[0].status).toBe("broken");
    void chart;
  });

  it("round-trips through export", () => {
    seed();
    const json = store().exportData();
    localStorage.clear();
    act(() => { store().importData(json); });
    const c = store().oathsCharts![0];
    expect(c.members.map((m) => m.name)).toEqual(["Aldric", "Kael", "Mira"]);
    expect(validateProjectData(JSON.parse(json))).toBe(true);
    expect(parseExport(json).oathsCharts).toHaveLength(1);
  });
});
