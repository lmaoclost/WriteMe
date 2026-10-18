import { beforeEach, describe, expect, it } from "vitest";
import { useScriptorium } from "./store";

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("undoable entity deletes", () => {
  it("deleteWellSpring arms undo; undoDelete reinserts the same board", () => {
    actInner(() => {
      const s = useScriptorium.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      s.addWellSpring(p, "Muse ideas");
    });
    const wells = () => useScriptorium.getState().wellsprings ?? [];
    const id = wells()[0]!.id;
    actInner(() => { useScriptorium.getState().deleteWellSpring(id); });
    expect(wells()).toHaveLength(0);
    actInner(() => { expect(useScriptorium.getState().undoDelete()).toBe(true); });
    expect(wells()).toHaveLength(1);
    expect(wells()[0]!.id).toBe(id);
    expect(wells()[0]!.name).toBe("Muse ideas");
  });

  it("a later delete replaces the undo slot", () => {
    actInner(() => {
      const s = useScriptorium.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      s.addWellSpring(p, "First");
      s.addConlang(p, "Conlang");
    });
    actInner(() => {
      const s = useScriptorium.getState();
      s.deleteWellSpring((s.wellsprings ?? [])[0]!.id);
      s.deleteConlang((s.conlangs ?? [])[0]!.id);
      s.undoDelete();
    });
    expect(useScriptorium.getState().wellsprings ?? []).toHaveLength(0);
    expect(useScriptorium.getState().conlangs ?? []).toHaveLength(1);
  });

  it("deleteAtlas and deleteManuscript arm undo too", () => {
    actInner(() => {
      const s = useScriptorium.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      s.addAtlas(p, "Main map");
    });
    actInner(() => { useScriptorium.getState().deleteAtlas(useScriptorium.getState().atlases[0].id); });
    expect(useScriptorium.getState().atlases).toHaveLength(0);
    actInner(() => { expect(useScriptorium.getState().undoDelete()).toBe(true); });
    expect(useScriptorium.getState().atlases[0]!.name).toBe("Main map");
  });

  it("undoDelete with nothing to undo returns false", () => {
    actInner(() => { expect(useScriptorium.getState().undoDelete()).toBe(false); });
  });
});

function actInner(fn: () => void) {
  fn();
}
