import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { parseExport, validateProjectData } from "./schema";
import { useScriptorium } from "./store";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

const timeline = () => store().timelines![0];

describe("store — timelines (era chain)", () => {
  it("addTimeline starts with an origin bead and one era at the origin", () => {
    store().addTimeline("prj_1", "Selo");
    const t = timeline();
    const origin = t.beads.find((b) => b.origin)!;
    expect(origin.x).toBe(0);
    expect(t.beads).toHaveLength(1);
    expect(t.eras).toHaveLength(1);
    expect(t.eras[0].startX).toBe(0);
  });

  it("the origin bead cannot move or be deleted", () => {
    store().addTimeline("prj_1", "Selo");
    const origin = timeline().beads[0];
    act(() => { store().moveBead(origin.id, 800, 40); });
    expect(timeline().beads[0].x).toBe(0);
    act(() => { store().deleteBead(origin.id); });
    expect(timeline().beads).toHaveLength(1);
  });

  it("addBead never places an event left of the origin", () => {
    store().addTimeline("prj_1", "Selo");
    const b = store().addBead(timeline().id, { x: -500, label: "Cerco" })!;
    expect(b.x).toBeGreaterThan(0);
  });

  it("addEra inserts a boundary and clamps it to the origin", () => {
    store().addTimeline("prj_1", "Selo");
    const t = store().addEra(timeline().id, 400, "Era da Prata")!;
    expect(timeline().eras).toHaveLength(2);
    expect(t.startX).toBe(400);
    const clamped = store().addEra(timeline().id, -300, "Antes")!;
    expect(clamped.startX).toBe(24);
  });

  it("addEra refuses a boundary too close to another era", () => {
    store().addTimeline("prj_1", "Selo");
    // the origin is a floor, not a neighbour: a clamped x right after it is legal
    const early = store().addEra(timeline().id, 4)!;
    expect(early.startX).toBe(24);
    act(() => { store().addEra(timeline().id, 400); });
    expect(store().addEra(timeline().id, 405)).toBeNull(); // 5px from the era at 400
  });

  it("bindEraBoundary ties a boundary to a bead and unbinding keeps the x", () => {
    store().addTimeline("prj_1", "Selo");
    const b = store().addBead(timeline().id, { x: 700, label: "Guerra" })!;
    const era = store().addEra(timeline().id, 300, "Guerra")!;
    act(() => { store().bindEraBoundary(era.id, b.id); });
    expect(timeline().eras.find((e) => e.id === era.id)!.boundaryBeadId).toBe(b.id);
    act(() => { store().bindEraBoundary(era.id, null); });
    const freed = timeline().eras.find((e) => e.id === era.id)!;
    expect(freed.boundaryBeadId).toBeUndefined();
    expect(freed.startX).toBe(700); // boundary stays where the event left it
  });

  it("moveEraBoundary never crosses a neighbour", () => {
    store().addTimeline("prj_1", "Selo");
    const first = store().addEra(timeline().id, 400, "A")!;
    const second = store().addEra(timeline().id, 900, "B")!;
    store().addEra(timeline().id, 1400, "C");
    act(() => { store().moveEraBoundary(first.id, 950); });
    expect(timeline().eras.find((e) => e.id === first.id)!.startX).toBe(876); // stops before B
    act(() => { store().moveEraBoundary(second.id, 1600); });
    expect(timeline().eras.find((e) => e.id === second.id)!.startX).toBe(1376); // stops before C
  });

  it("moveBead clamps a boundary bead so eras cannot swap order", () => {
    store().addTimeline("prj_1", "Selo");
    const b1 = store().addBead(timeline().id, { x: 400 })!;
    const b2 = store().addBead(timeline().id, { x: 900 })!;
    const first = store().addEra(timeline().id, 400, "A")!;
    const second = store().addEra(timeline().id, 900, "B")!;
    act(() => { store().bindEraBoundary(first.id, b1.id); });
    act(() => { store().bindEraBoundary(second.id, b2.id); });
    act(() => { store().moveBead(b1.id, 1500, 40); });
    expect(timeline().beads.find((b) => b.id === b1.id)!.x).toBe(876); // stops before B's boundary
    // an ordinary bead crosses boundaries freely: only boundaries constrain each other
    act(() => { store().moveBead(b2.id, 1500, 40); });
    expect(timeline().beads.find((b) => b.id === b2.id)!.x).toBe(1500);
  });

  it("deleting a boundary bead leaves the boundary where it was", () => {
    store().addTimeline("prj_1", "Selo");
    const b = store().addBead(timeline().id, { x: 700, label: "Guerra" })!;
    const era = store().addEra(timeline().id, 300, "Guerra")!;
    act(() => { store().bindEraBoundary(era.id, b.id); });
    act(() => { store().deleteBead(b.id); });
    const kept = timeline().eras.find((e) => e.id === era.id)!;
    expect(kept.boundaryBeadId).toBeUndefined();
    expect(kept.startX).toBe(700);
  });

  it("deleteEra keeps at least one era and pushes history", () => {
    store().addTimeline("prj_1", "Selo");
    const era = store().addEra(timeline().id, 500, "A")!;
    act(() => { store().deleteEra(era.id); });
    expect(timeline().eras).toHaveLength(1); // the origin era survives
    act(() => { store().deleteEra(timeline().eras[0].id); }); // last era: no-op
    expect(timeline().eras).toHaveLength(1);
    act(() => { store().undoTL(timeline().id); }); // back to before the delete
    expect(timeline().eras).toHaveLength(2);
    act(() => { store().redoTL(timeline().id); });
    expect(timeline().eras).toHaveLength(1);
  });

  it("beads carry a calendar event reference", () => {
    store().addTimeline("prj_1", "Selo");
    const b = store().addBead(timeline().id, { x: 600 })!;
    act(() => { store().updateBead(b.id, { calendarEvent: { calendarId: "cal_1", dayKey: "0:2:5", eventId: "ce_1" } }); });
    expect(timeline().beads.find((x) => x.id === b.id)!.calendarEvent).toEqual({ calendarId: "cal_1", dayKey: "0:2:5", eventId: "ce_1" });
  });

  it("round-trips through export", () => {
    store().addTimeline("prj_1", "Selo");
    act(() => { store().addBead(timeline().id, { x: 800, label: "A", y: -60 }); });
    act(() => { store().addEra(timeline().id, 100, "Era I"); });
    const json = store().exportData();
    localStorage.clear();
    act(() => { store().importData(json); });
    const t = timeline();
    expect(t.beads.some((b) => b.label === "A")).toBe(true);
    expect(t.eras.some((e) => e.label === "Era I")).toBe(true);
    expect(parseExport(json).timelines).toHaveLength(1);
    expect(validateProjectData(JSON.parse(json))).toBe(true);
  });
});
