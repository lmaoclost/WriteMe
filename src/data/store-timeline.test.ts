import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { parseExport, validateProjectData } from "./schema";
import { useScriptorium } from "./store";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("store — timelines (fio)", () => {
  it("addTimeline defaults vazios v1", () => {
    const t = store().addTimeline("prj_1", "Selo");
    expect(t.beads).toEqual([]);
    expect(t.segments).toEqual([]);
  });

  it("addBead defaults + dateText", () => {
    const t = store().addTimeline("prj_1", "Selo");
    const b = store().addBead(t.id, { x: 1200, label: "Cerco", dateText: "Inverno 1200" })!;
    expect(b.y).toBe(-60);
    expect(b.color).toBe("#e67e22");
    expect(b.dateText).toBe("Inverno 1200");
  });

  it("addSegment requires toX > fromX; undo/redo", () => {
    const t = store().addTimeline("prj_1", "Selo");
    expect(store().addSegment(t.id, 500, 500)).toBeNull();
    act(() => { store().addSegment(t.id, 500, 1500, "Ida do Selo"); });
    act(() => { store().addBead(t.id, { x: 900 }); });
    act(() => { store().undoTL(t.id); });
    expect(store().timelines![0].beads).toHaveLength(0);
    expect(store().timelines![0].segments).toHaveLength(1);
    act(() => { store().undoTL(t.id); });
    expect(store().timelines![0].segments).toHaveLength(0);
    act(() => { store().redoTL(t.id); });
    expect(store().timelines![0].segments).toHaveLength(1);
  });

  it("deleteBead pushes history", () => {
    const t = store().addTimeline("prj_1", "Selo");
    const b = store().addBead(t.id)!;
    act(() => { store().deleteBead(b.id); });
    expect(store().timelines![0].beads).toHaveLength(0);
    act(() => { store().undoTL(t.id); });
    expect(store().timelines![0].beads).toHaveLength(1);
  });

  it("round-trips through export", () => {
    const t = store().addTimeline("prj_1", "Selo");
    act(() => { store().addBead(t.id, { x: 800, label: "A", y: -60 }); });
    act(() => { store().addSegment(t.id, 100, 1000, "Era I"); });
    const json = store().exportData();
    localStorage.clear();
    act(() => { store().importData(json); });
    const tl = store().timelines![0];
    expect(tl.beads[0].label).toBe("A");
    expect(tl.segments[0].label).toBe("Era I");
    expect(parseExport(json).timelines).toHaveLength(1);
    expect(validateProjectData(JSON.parse(json))).toBe(true);
  });
});
