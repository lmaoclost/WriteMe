import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { parseExport, validateProjectData } from "./schema";
import { useScriptorium } from "./store";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("store — conlang", () => {
  it("addGlyph: char único; addWord requer palavra; export/undo", () => {
    const c = store().addConlang("prj_1", "Fala do Selo");
    const g = store().addGlyph(c.id, "A")!;
    expect(store().addGlyph(c.id, "A")).toBeNull(); // dup
    act(() => { store().updateGlyph(g.id, { svgPath: "M10 10 L 40 40" }); });
    expect(store().addWord(c.id, { word: "" })).toBeNull();
    const w = store().addWord(c.id, { word: "sarnen", meaning: "rio-mãe", pos: "substantivo", theme: "águas" })!;
    expect(store().conlangs![0].words[0].word).toBe("sarnen");
    act(() => { store().deleteGlyph(g.id); });
    expect(store().conlangs![0].glyphs).toHaveLength(0);
    act(() => { store().undoCN(c.id); });
    expect(store().conlangs![0].glyphs).toHaveLength(1);
    act(() => { store().redoCN(c.id); });
    expect(store().conlangs![0].glyphs).toHaveLength(0);
    act(() => { store().undoCN(c.id); }); // undo delete do glyph de volta
    act(() => { store().deleteWord(w.id); });
    act(() => { store().undoCN(c.id); });
    const json = store().exportData();
    localStorage.clear();
    act(() => { store().importData(json); });
    const c2 = store().conlangs![0];
    expect(c2.glyphs).toHaveLength(1);
    expect(c2.words[0].meaning).toBe("rio-mãe");
    expect(validateProjectData(JSON.parse(json))).toBe(true);
    expect(parseExport(json).conlangs).toHaveLength(1);
  });
});
