import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { validateProjectData, parseExport } from "./schema";
import { useScriptorium } from "./store";
import type { PlotBoard } from "../domain/types";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

const cardIds = (b: PlotBoard) => b.cards.map((c) => c.id);

describe("store — plot boards", () => {
  it("addPlotBoard defaults: 3 atos, sem flags, vazio", () => {
    const b = store().addPlotBoard("prj_1", "Guerra");
    expect(b.acts.map((a) => a.name)).toEqual(["Ato 1", "Ato 2", "Ato 3"]);
    expect(b.hasPrologue).toBe(false);
    expect(b.hasEpilogue).toBe(false);
    expect(b.cards).toEqual([]);
    expect(b.wires).toEqual([]);
  });

  it("addCard in act + panel-less position default", () => {
    const b = store().addPlotBoard("prj_1", "G");
    const c = store().addCard(b.id, { actId: b.acts[1].id, x: 500, y: 300 })!;
    expect(cardIds(store().plotBoards![0])).toContain(c.id);
    expect(c.actId).toBe(b.acts[1].id);
    expect(c.parts).toEqual([]);
    expect(c.color).toBe("#7c5cbf");
  });

  it("updateCard edits title/pov/parts (aliased clones)", () => {
    const b = store().addPlotBoard("prj_1", "G");
    const c = store().addCard(b.id)!;
    const parts = [{ id: "part_1", text: "beba o rio" }];
    act(() => { store().updateCard(c.id, { title: "A chegada", pov: "Aerith", parts }); });
    parts[0].text = "MUTADO";
    const card = store().plotBoards![0].cards[0];
    expect(card.parts[0].text).toBe("beba o rio"); // clone, not alias
    expect(card.title).toBe("A chegada");
  });

  it("moveCard does not push history; updateCard does", () => {
    const b = store().addPlotBoard("prj_1", "G");
    const c = store().addCard(b.id)!;
    const before = store().histories[`pb_${b.id}`]?.undo.length ?? 0; // addCard pushed once
    act(() => { store().moveCard(c.id, 100, 200); });
    expect((store().histories[`pb_${b.id}`]?.undo.length ?? 0)).toBe(before); // move: no push
    act(() => { store().updateCard(c.id, { title: "x" }); });
    expect(store().histories[`pb_${b.id}`]?.undo.length).toBe(before + 1);
  });

  it("addWire guards: self, unknown, duplicate (either direction); undo removes", () => {
    const b = store().addPlotBoard("prj_1", "G");
    const a = store().addCard(b.id)!;
    const c = store().addCard(b.id)!;
    expect(store().addWire(b.id, a.id, a.id)).toBeNull();
    act(() => { store().addWire(b.id, a.id, c.id); });
    expect(store().addWire(b.id, c.id, a.id)).toBeNull();
    act(() => { store().addWire(b.id, a.id, "fantasma"); });
    expect(store().plotBoards![0].wires).toHaveLength(1);
    act(() => { store().undoPB(b.id); });
    expect(store().plotBoards![0].wires).toHaveLength(0);
    act(() => { store().redoPB(b.id); });
    expect(store().plotBoards![0].wires).toHaveLength(1);
  });

  it("deleteCard drops incident wires", () => {
    const b = store().addPlotBoard("prj_1", "G");
    const a = store().addCard(b.id)!;
    const c = store().addCard(b.id)!;
    act(() => { store().addWire(b.id, a.id, c.id); });
    act(() => { store().deleteCard(a.id); });
    const board = store().plotBoards![0];
    expect(board.cards.map((x) => x.id)).toEqual([c.id]);
    expect(board.wires).toHaveLength(0);
  });

  it("setBoardActs renames / setBoardFlags toggles prologue", () => {
    const b = store().addPlotBoard("prj_1", "G");
    act(() => { store().setBoardActs(b.id, b.acts.map((a, i) => ({ id: a.id, name: `Parte ${i + 1}` }))); });
    act(() => { store().setBoardFlags(b.id, { hasPrologue: true }); });
    const board = store().plotBoards![0];
    expect(board.acts[0].name).toBe("Parte 1");
    expect(board.hasPrologue).toBe(true);
  });

  it("deletePlotBoard drops history + round-trips", () => {
    const b = store().addPlotBoard("prj_1", "G");
    act(() => { store().addCard(b.id, { title: "x" }); });
    act(() => { store().deletePlotBoard(b.id); });
    expect(store().plotBoards).toHaveLength(0);
    expect(store().histories[`pb_${b.id}`]).toBeUndefined();
    const json = store().exportData();
    const d = parseExport(json);
    expect(validateProjectData(d)).toBe(true);
    expect(d.plotBoards).toEqual([]);
  });
});
