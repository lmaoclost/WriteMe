import { describe, expect, it } from "vitest";
import type { Chapter, Manuscript, Part, Scene } from "./types";
import {
  createScene,
  moveChapterInPlan,
  moveSceneInPlan,
  normalizeManuscripts,
  reorderPartsTo,
} from "./manuscript";

const scene = (id: string, content: string, order: number): Scene => ({ id, content, order });

const chapter = (id: string, order: number, scenes: Scene[], partId?: string, extra?: Partial<Chapter>): Chapter => ({
  id,
  heading: id,
  scenes,
  order,
  partId,
  ...extra,
});

const part = (id: string, order: number, title = id): Part => ({ id, title, order });

const book = (chapters: Chapter[], parts: Part[] = []): Manuscript => ({
  id: "man_1",
  projectId: "prj_1",
  title: "Livro",
  author: "",
  chapters,
  parts,
});

describe("normalizeManuscripts", () => {
  it("turns a legacy content-only chapter into one scene holding its body", () => {
    const legacy = {
      ...book([{ id: "ch_1", heading: "Um", content: "corpo<br>antigo", order: 0 } as unknown as Chapter]),
    };
    const out = normalizeManuscripts([legacy]);
    const ch = out[0].chapters[0];
    expect(ch.scenes).toHaveLength(1);
    expect(ch.scenes[0].content).toBe("corpo<br>antigo");
    expect(ch.scenes[0].order).toBe(0);
    expect("content" in ch).toBe(false);
  });

  it("gives an empty chapter one empty scene", () => {
    const input = book([{ id: "ch_1", heading: "Um", scenes: [], order: 0 }]);
    const ch = normalizeManuscripts([input])[0].chapters[0];
    expect(ch.scenes).toHaveLength(1);
    expect(ch.scenes[0].content).toBe("");
  });

  it("keeps existing scenes and leaves ids untouched", () => {
    const input = book([{ id: "ch_1", heading: "Um", scenes: [scene("sc_a", "a", 5), scene("sc_b", "b", 1)], order: 0 }]);
    const ch = normalizeManuscripts([input])[0].chapters[0];
    expect(ch.scenes.map((s) => s.id)).toEqual(["sc_a", "sc_b"]);
  });
});

describe("createScene", () => {
  it("mints a fresh sc_ id with the given content", () => {
    const s = createScene("<p>olá</p>");
    expect(s.id).toMatch(/^sc_/);
    expect(s.content).toBe("<p>olá</p>");
    expect(s.order).toBe(0);
  });
});

describe("moveSceneInPlan", () => {
  const sceneA = (n: string) => scene(`sc_${n}`, n, 0);

  it("reorders within the chapter and renumbers that chapter's scenes", () => {
    const chapters = [
      chapter("ch_1", 0, [sceneA("a"), sceneA("b"), sceneA("c")]),
    ];
    const out = moveSceneInPlan(chapters, "sc_a", "ch_1", 2);
    expect(out[0].scenes.map((s) => s.id)).toEqual(["sc_b", "sc_c", "sc_a"]);
    expect(out[0].scenes.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it("moves a scene to another chapter, renumbering both sides", () => {
    const chapters = [
      chapter("ch_1", 0, [sceneA("a"), sceneA("b")]),
      chapter("ch_2", 1, [sceneA("x")]),
    ];
    const out = moveSceneInPlan(chapters, "sc_a", "ch_2", 0);
    expect(out[0].scenes.map((s) => s.id)).toEqual(["sc_b"]);
    expect(out[0].scenes.map((s) => s.order)).toEqual([0]);
    expect(out[1].scenes.map((s) => s.id)).toEqual(["sc_a", "sc_x"]);
    expect(out[1].scenes.map((s) => s.order)).toEqual([0, 1]);
  });

  it("refuses to drain a chapter below one scene", () => {
    const chapters = [
      chapter("ch_1", 0, [sceneA("only")]),
      chapter("ch_2", 1, [sceneA("x")]),
    ];
    const out = moveSceneInPlan(chapters, "sc_only", "ch_2", 0);
    expect(out[0].scenes.map((s) => s.id)).toEqual(["sc_only"]);
    expect(out[1].scenes.map((s) => s.id)).toEqual(["sc_x"]);
  });

  it("clamps out-of-range indexes to the end of the target chapter", () => {
    const chapters = [
      chapter("ch_1", 0, [sceneA("a"), sceneA("b")]),
      chapter("ch_2", 1, [sceneA("x")]),
    ];
    const out = moveSceneInPlan(chapters, "sc_a", "ch_2", 9);
    expect(out[1].scenes.map((s) => s.id)).toEqual(["sc_x", "sc_a"]);
  });

  it("ignores an unknown scene id", () => {
    const chapters = [chapter("ch_1", 0, [sceneA("a")])];
    const out = moveSceneInPlan(chapters, "sc_missing", "ch_1", 0);
    expect(out).toEqual(chapters);
  });
});

describe("moveChapterInPlan", () => {
  const s = (n: string) => scene(`sc_${n}`, "corpo", 0);

  it("moves the chapter into a part and renumbers the whole book plan", () => {
    const chapters = [
      chapter("ch_1", 0, [s("a")]),
      chapter("ch_2", 1, [s("b")]),
      chapter("ch_3", 2, [s("c")]),
    ];
    const parts = [part("pt_1", 1), part("pt_2", 2)];
    const out = moveChapterInPlan(chapters, parts, "ch_3", "pt_1", 0);
    const byId = new Map(out.map((c) => [c.id, c]));
    // global renumber follows the print plan: the ungrouped run first
    expect(byId.get("ch_1")?.order).toBe(0);
    expect(byId.get("ch_2")?.order).toBe(1);
    expect(byId.get("ch_3")?.partId).toBe("pt_1");
    expect(byId.get("ch_3")?.order).toBe(2);
  });

  it("inserts at the requested position of the target part among that part's chapters", () => {
    const chapters = [
      chapter("ch_1", 0, [s("a")], "pt_1"),
      chapter("ch_2", 1, [s("b")], "pt_1"),
      chapter("ch_3", 2, [s("c")]),
    ];
    const parts = [part("pt_1", 1)];
    const out = moveChapterInPlan(chapters, parts, "ch_3", "pt_1", 1);
    const byId = new Map(out.map((c) => [c.id, c]));
    expect(byId.get("ch_3")?.partId).toBe("pt_1");
    // within pt_1: ch_1, ch_3, ch_2 → global renumber 0,1,2
    expect(byId.get("ch_1")?.order).toBe(0);
    expect(byId.get("ch_3")?.order).toBe(1);
    expect(byId.get("ch_2")?.order).toBe(2);
  });

  it("moves a chapter back to the ungrouped run", () => {
    const chapters = [
      chapter("ch_1", 0, [s("a")]),
      chapter("ch_2", 1, [s("b")], "pt_1"),
    ];
    const parts = [part("pt_1", 1)];
    const out = moveChapterInPlan(chapters, parts, "ch_2", undefined, 1);
    const byId = new Map(out.map((c) => [c.id, c]));
    expect(byId.get("ch_2")?.partId).toBeUndefined();
    expect(byId.get("ch_2")?.order).toBe(1);
  });

  it("counts chapters of dangling parts as ungrouped", () => {
    const chapters = [
      chapter("ch_1", 0, [s("a")], "pt_gone"),
      chapter("ch_2", 1, [s("b")]),
    ];
    const out = moveChapterInPlan(chapters, [], "ch_2", undefined, 0);
    const byId = new Map(out.map((c) => [c.id, c]));
    expect(byId.get("ch_2")?.order).toBe(0);
  });

  it("ignores an unknown chapter id", () => {
    const chapters = [chapter("ch_1", 0, [s("a")])];
    const parts = [part("pt_1", 1)];
    const out = moveChapterInPlan(chapters, parts, "ch_missing", "pt_1", 0);
    expect(out).toEqual(chapters);
  });
});

describe("reorderPartsTo", () => {
  it("splices the part at the new index and renumbers 1-based", () => {
    const parts = [part("pt_1", 1, "A"), part("pt_2", 2, "B"), part("pt_3", 3, "C")];
    const out = reorderPartsTo(parts, "pt_3", 0);
    expect(out.map((p) => p.id)).toEqual(["pt_3", "pt_1", "pt_2"]);
    expect(out.map((p) => p.order)).toEqual([1, 2, 3]);
  });

  it("clamps out-of-range indexes", () => {
    const parts = [part("pt_1", 1, "A"), part("pt_2", 2, "B")];
    const out = reorderPartsTo(parts, "pt_1", 7);
    expect(out.map((p) => p.id)).toEqual(["pt_2", "pt_1"]);
  });

  it("ignores an unknown part id", () => {
    const parts = [part("pt_1", 1, "A")];
    expect(reorderPartsTo(parts, "pt_missing", 0)).toEqual(parts);
  });
});
