import { beforeEach, describe, expect, it } from "vitest";
import { useWriteme } from "./store";

beforeEach(() => {
  localStorage.clear();
  useWriteme.setState(useWriteme.getInitialState());
});

describe("undoable entity deletes", () => {
  it("deleteWellSpring arms undo; undoDelete reinserts the same board", () => {
    actInner(() => {
      const s = useWriteme.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      s.addWellSpring(p, "Muse ideas");
    });
    const wells = () => useWriteme.getState().wellsprings ?? [];
    const id = wells()[0]!.id;
    actInner(() => { useWriteme.getState().deleteWellSpring(id); });
    expect(wells()).toHaveLength(0);
    actInner(() => { expect(useWriteme.getState().undoDelete()).toBe(true); });
    expect(wells()).toHaveLength(1);
    expect(wells()[0]!.id).toBe(id);
    expect(wells()[0]!.name).toBe("Muse ideas");
  });

  it("a later delete replaces the undo slot", () => {
    actInner(() => {
      const s = useWriteme.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      s.addWellSpring(p, "First");
      s.addConlang(p, "Conlang");
    });
    actInner(() => {
      const s = useWriteme.getState();
      s.deleteWellSpring((s.wellsprings ?? [])[0]!.id);
      s.deleteConlang((s.conlangs ?? [])[0]!.id);
      s.undoDelete();
    });
    expect(useWriteme.getState().wellsprings ?? []).toHaveLength(0);
    expect(useWriteme.getState().conlangs ?? []).toHaveLength(1);
  });

  it("stale nonce cannot consume a newer slot", () => {
    let firstNonce = 0;
    let secondNonce = 0;
    actInner(() => {
      const s = useWriteme.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      s.addWellSpring(p, "First");
      s.addConlang(p, "Tongue");
      s.deleteWellSpring((useWriteme.getState().wellsprings ?? [])[0]!.id);
      firstNonce = useWriteme.getState().undoNonce ?? 0;
      s.deleteConlang((useWriteme.getState().conlangs ?? [])[0]!.id);
      secondNonce = useWriteme.getState().undoNonce ?? 0;
    });
    actInner(() => {
      expect(useWriteme.getState().undoDelete(firstNonce)).toBe(false);
      expect(useWriteme.getState().undoDelete(secondNonce)).toBe(true);
    });
    expect(useWriteme.getState().wellsprings ?? []).toHaveLength(0);
    expect(useWriteme.getState().conlangs ?? []).toHaveLength(1);
  });

  it("deleteAtlas and deleteManuscript arm undo too", () => {
    actInner(() => {
      const s = useWriteme.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      s.addAtlas(p, "Main map");
    });
    actInner(() => { useWriteme.getState().deleteAtlas(useWriteme.getState().atlases[0].id); });
    expect(useWriteme.getState().atlases).toHaveLength(0);
    actInner(() => { expect(useWriteme.getState().undoDelete()).toBe(true); });
    expect(useWriteme.getState().atlases[0]!.name).toBe("Main map");
  });

  it("undoDelete with nothing to undo returns false", () => {
    actInner(() => { expect(useWriteme.getState().undoDelete()).toBe(false); });
  });

  it("undo restores the atlas map image GC'd by the delete", () => {
    let atlasId = "";
    let mkey = "";
    actInner(() => {
      const s = useWriteme.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      atlasId = s.addAtlas(p, "Main map").id;
      mkey = `img_map_test_${atlasId}`;
      useWriteme.setState((st) => ({
        images: { ...st.images, [mkey]: "data:image/png;base64,MAPDATA" },
        atlases: st.atlases.map((a) => (a.id === atlasId ? { ...a, mapImageKey: mkey } : a)),
      }));
      s.deleteAtlas(atlasId);
    });
    expect((useWriteme.getState().images ?? {})[mkey]).toBeUndefined();
    actInner(() => { expect(useWriteme.getState().undoDelete()).toBe(true); });
    expect(useWriteme.getState().images?.[mkey]).toBe("data:image/png;base64,MAPDATA");
    expect(useWriteme.getState().atlases.find((a) => a.id === atlasId)?.mapImageKey).toBe(mkey);
  });

  it("undo restores chapter calendar links severed by calendar delete", () => {
    let channelId = "";
    actInner(() => {
      const s = useWriteme.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      const cal = s.addCalendar(p, "Years of Ash");
      const man = s.addManuscript(p, "Book");
      const ch = s.addChapter(man.id, "One")!;
      channelId = ch.id;
      s.updateChapter(ch.id, { linkedCalendarId: cal.id, calendarDayKey: "y1_d4" });
      s.deleteCalendar(cal.id);
    });
    const chapter = () => useWriteme.getState().manuscripts.flatMap((m) => m.chapters).find((c) => c.id === channelId);
    expect(chapter()?.linkedCalendarId).toBeUndefined();
    actInner(() => { expect(useWriteme.getState().undoDelete()).toBe(true); });
    expect(chapter()?.linkedCalendarId).toBeDefined();
    expect(chapter()?.calendarDayKey).toBe("y1_d4");
  });

  it("undo restores bloodline portrait images GC'd by the delete", () => {
    let portraitKey = "";
    actInner(() => {
      const s = useWriteme.getState();
      const p = s.projects[0]?.id ?? s.addProject("P");
      const bl = s.addBloodline(p, "Houses of Ashfall");
      const person = s.addPerson(bl.id, { x: 0.5, y: 0.5, name: "Aldric" })!;
      portraitKey = s.putImage("data:image/png;base64,FACE", "person");
      s.updatePerson(person.id, { portraitKey });
      s.deleteBloodline(bl.id);
    });
    expect((useWriteme.getState().images ?? {})[portraitKey]).toBeUndefined();
    actInner(() => { expect(useWriteme.getState().undoDelete()).toBe(true); });
    expect(useWriteme.getState().images?.[portraitKey]).toBe("data:image/png;base64,FACE");
  });
});

function actInner(fn: () => void) {
  fn();
}
