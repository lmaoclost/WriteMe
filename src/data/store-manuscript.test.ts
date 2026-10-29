import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useScriptorium } from "./store";
import { validateProjectData } from "./schema";
import type { Chapter, Manuscript, Part, Project, Scene } from "../domain/types";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

function makeProject(): Project {
  let p!: Project;
  act(() => { p = store().addProject("Reino"); });
  return p;
}

function makeManuscript(title?: string): Manuscript {
  const p = makeProject();
  let m!: Manuscript;
  act(() => { m = store().addManuscript(p.id, title); });
  return m;
}

function makeChapter(manuscriptId: string, heading?: string): Chapter {
  let c!: Chapter;
  act(() => { c = store().addChapter(manuscriptId, heading) as Chapter; });
  expect(c, "chapter should be created").toBeTruthy();
  return c;
}

function makeScene(chapterId: string): Scene {
  let s!: Scene;
  act(() => { s = store().addScene(chapterId) as Scene; });
  expect(s, "scene should be created").toBeTruthy();
  return s;
}

function chaptersOf(id: string): Chapter[] {
  return useScriptorium.getState().manuscripts.find((m) => m.id === id)!.chapters;
}

function chapterById(chId: string): Chapter | undefined {
  return useScriptorium.getState().manuscripts.flatMap((m) => m.chapters).find((c) => c.id === chId);
}

function makePart(manuscriptId: string, title?: string): Part {
  let p!: Part;
  act(() => { p = store().addPart(manuscriptId, title) as Part; });
  expect(p, "part should be created").toBeTruthy();
  return p;
}

function partsOf(id: string): Part[] {
  return useScriptorium.getState().manuscripts.find((m) => m.id === id)?.parts ?? [];
}

describe("addManuscript", () => {
  it("creates with default title, empty author, no chapters and a man_ id", () => {
    const project = makeProject();
    let m!: Manuscript;
    act(() => { m = store().addManuscript(project.id); });
    expect(m.id).toMatch(/^man_/);
    expect(m.projectId).toBe(project.id);
    expect(m.title).toBe("Untitled Manuscript");
    expect(m.author).toBe("");
    expect(m.chapters).toEqual([]);
    expect(store().manuscripts).toHaveLength(1);
  });

  it("accepts an explicit title", () => {
    const m = makeManuscript("Vellmora");
    expect(m.title).toBe("Vellmora");
  });

  it("bumps project updatedAt", () => {
    const project = makeProject();
    const t1 = project.updatedAt;
    act(() => { store().addManuscript(project.id); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("renameManuscript / setManuscriptAuthor", () => {
  it("rename applies the new title", () => {
    const m = makeManuscript("Velha");
    act(() => { store().renameManuscript(m.id, "Nova"); });
    expect(store().manuscripts.find((x) => x.id === m.id)?.title).toBe("Nova");
  });
  it("rename bumps project updatedAt", () => {
    const m = makeManuscript();
    const t1 = store().projects[0].updatedAt;
    act(() => { store().renameManuscript(m.id, "Nova"); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
  it("setManuscriptAuthor applies the author", () => {
    const m = makeManuscript();
    act(() => { store().setManuscriptAuthor(m.id, "Renan"); });
    expect(store().manuscripts.find((x) => x.id === m.id)?.author).toBe("Renan");
  });
  it("setManuscriptAuthor bumps project updatedAt", () => {
    const m = makeManuscript();
    const t1 = store().projects[0].updatedAt;
    act(() => { store().setManuscriptAuthor(m.id, "Renan"); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
  it("ignores unknown ids", () => {
    const before = store().manuscripts.slice();
    act(() => { store().renameManuscript("man_missing", "X"); store().setManuscriptAuthor("man_missing", "Y"); });
    expect(store().manuscripts).toEqual(before);
  });
});

describe("deleteManuscript", () => {
  it("removes the manuscript and its chapters (no images to release)", () => {
    const m = makeManuscript();
    makeChapter(m.id);
    const images = store().images;
    act(() => { store().deleteManuscript(m.id); });
    const s = store();
    expect(s.manuscripts).toHaveLength(0);
    expect(images).toBe(s.images);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const t1 = store().projects[0].updatedAt;
    act(() => { store().deleteManuscript(m.id); });
    const s = store();
    expect(s.projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
  it("ignores an unknown id", () => {
    const before = store().manuscripts.slice();
    act(() => { store().deleteManuscript("man_missing"); });
    expect(store().manuscripts).toEqual(before);
  });
});

describe("addChapter", () => {
  it("creates with default heading, order 0 and one empty scene", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    expect(c.id).toMatch(/^ch_/);
    expect(c.heading).toBe("Untitled Chapter");
    expect(c.scenes).toHaveLength(1);
    expect(c.scenes[0].id).toMatch(/^sc_/);
    expect(c.scenes[0].content).toBe("");
    expect(c.order).toBe(0);
    expect(chaptersOf(m.id)).toHaveLength(1);
  });
  it("orders max(orders)+1 and tolerates gaps", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id, "Um");
    const b = makeChapter(m.id, "Dois");
    act(() => {
      useScriptorium.setState((s) => ({
        manuscripts: s.manuscripts.map((x) => (x.id === m.id
          ? { ...x, chapters: [...x.chapters.filter((y) => y.id !== a.id), { ...a, order: 7 }] }
          : x)),
      }));
    });
    act(() => { void b; });
    const next = makeChapter(m.id, "Três");
    expect(next.order).toBe(8);
  });
  it("returns null for an unknown manuscript", () => {
    let c: Chapter | null = null;
    act(() => { c = store().addChapter("man_missing"); });
    expect(c).toBeNull();
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const t1 = store().projects[0].updatedAt;
    makeChapter(m.id);
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("updateChapter", () => {
  it("applies the patch and preserves the id", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id, "Um");
    act(() => { store().updateChapter(c.id, { heading: "Um novo" }); });
    const stored = chaptersOf(m.id).find((x) => x.id === c.id)!;
    expect(stored.heading).toBe("Um novo");
    expect(stored.id).toBe(c.id);
    expect(stored.order).toBe(0);
  });
  it("clones the patch so later mutation cannot alias into the store", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id, "Um");
    const newScenes: Scene[] = [{ id: "sc_x", content: "rascunho", order: 0 }];
    const patch: Partial<Omit<Chapter, "id">> = { scenes: newScenes };
    act(() => { store().updateChapter(c.id, patch); });
    newScenes[0].content = "mutado";
    expect(chapterById(c.id)?.scenes[0].content).toBe("rascunho");
  });
  it("ignores an unknown id", () => {
    const before = useScriptorium.getState().manuscripts.slice();
    act(() => { store().updateChapter("ch_missing", { heading: "X" }); });
    expect(store().manuscripts).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id, "Um");
    const t1 = store().projects[0].updatedAt;
    act(() => { store().updateChapter(c.id, { heading: "novo" }); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("deleteChapter", () => {
  it("removes the chapter and leaves an order gap (no renumbering)", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id, "Um");
    const b = makeChapter(m.id, "Dois");
    const c = makeChapter(m.id, "Três");
    act(() => { store().deleteChapter(b.id); });
    const left = chaptersOf(m.id);
    expect(left.map((x) => x.id)).toEqual([a.id, c.id]);
    expect(left.map((x) => x.order)).toEqual([0, 2]);
  });
  it("ignores an unknown id", () => {
    const before = useScriptorium.getState().manuscripts.slice();
    act(() => { store().deleteChapter("ch_missing"); });
    expect(store().manuscripts).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id, "Um");
    const t1 = store().projects[0].updatedAt;
    act(() => { store().deleteChapter(c.id); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("addScene", () => {
  it("appends an empty scene with max(orders)+1 and a sc_ id", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    const s = makeScene(c.id);
    expect(s.id).toMatch(/^sc_/);
    expect(s.content).toBe("");
    expect(s.order).toBe(chapterById(c.id)!.scenes.length - 1);
    expect(chapterById(c.id)!.scenes).toHaveLength(2);
  });
  it("returns null for an unknown chapter", () => {
    let s: Scene | null = null;
    act(() => { s = store().addScene("ch_missing"); });
    expect(s).toBeNull();
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    const t1 = store().projects[0].updatedAt;
    act(() => { store().addScene(c.id); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("updateScene", () => {
  it("patches the scene's content and preserves id and order", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    act(() => { store().updateScene(c.scenes[0].id, { content: "<p>texto</p>" }); });
    const s = chapterById(c.id)!.scenes[0];
    expect(s.content).toBe("<p>texto</p>");
    expect(s.id).toBe(c.scenes[0].id);
    expect(s.order).toBe(0);
  });
  it("ignores an unknown scene id", () => {
    const before = useScriptorium.getState().manuscripts.slice();
    act(() => { store().updateScene("sc_missing", { content: "X" }); });
    expect(store().manuscripts).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    const t1 = store().projects[0].updatedAt;
    act(() => { store().updateScene(c.scenes[0].id, { content: "novo" }); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("deleteScene", () => {
  it("deletes a scene and renumbers the chapter", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    const s2 = makeScene(c.id as never as string);
    const s3 = makeScene(c.id as never as string);
    act(() => { store().deleteScene(s2.id); });
    const scenes = chapterById(c.id)!.scenes;
    expect(scenes.map((x) => x.id)).toEqual([c.scenes[0].id, s3.id]);
    expect(scenes.map((x) => x.order)).toEqual([0, 1]);
  });
  it("refuses when the chapter would drop below one scene", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    const s1 = chapterById(c.id)!.scenes[0];
    act(() => { store().deleteScene(s1.id); });
    expect(chapterById(c.id)!.scenes.map((x) => x.id)).toEqual([s1.id]);
  });
  it("ignores an unknown scene id", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    const before = chapterById(c.id)!.scenes;
    act(() => { store().deleteScene("sc_missing"); });
    expect(chapterById(c.id)!.scenes).toEqual(before);
  });
  it("bumps project updatedAt when it deletes", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    makeScene(c.id);
    const t1 = store().projects[0].updatedAt;
    act(() => { store().deleteScene(c.scenes[0].id); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
  it("does not bump project updatedAt on refusal", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    act(() => { store().updateScene(c.scenes[0].id, { content: "x" }); });
    const t1 = store().projects[0].updatedAt;
    act(() => { store().deleteScene(c.scenes[0].id); });
    expect(store().projects[0].updatedAt).toBe(t1);
  });
});

describe("moveScene", () => {
  it("reorders within the chapter", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    makeScene(c.id);
    makeScene(c.id);
    const [s0, s1, s2] = chapterById(c.id)!.scenes;
    act(() => { store().moveScene(s0.id, c.id, 2); });
    expect(chapterById(c.id)!.scenes.map((x) => x.id)).toEqual([s1.id, s2.id, s0.id]);
    expect(chapterById(c.id)!.scenes.map((x) => x.order)).toEqual([0, 1, 2]);
  });
  it("moves across chapters and renumbers both", () => {
    const m = makeManuscript();
    const c1 = makeChapter(m.id);
    makeScene(c1.id);
    const [c1s0, c1s1] = chapterById(c1.id)!.scenes;
    const c2 = makeChapter(m.id);
    const autoScene = chapterById(c2.id)!.scenes[0];
    act(() => { store().moveScene(c1s0.id, c2.id, 0); });
    expect(chapterById(c1.id)!.scenes.map((x) => x.id)).toEqual([c1s1.id]);
    expect(chapterById(c1.id)!.scenes.map((x) => x.order)).toEqual([0]);
    expect(chapterById(c2.id)!.scenes.map((x) => x.id)).toEqual([c1s0.id, autoScene.id]);
    expect(chapterById(c2.id)!.scenes.map((x) => x.order)).toEqual([0, 1]);
  });
  it("refuses to drain the source chapter below one scene", () => {
    const m = makeManuscript();
    const c1 = makeChapter(m.id);
    const c2 = makeChapter(m.id);
    const only = chapterById(c1.id)!.scenes[0];
    act(() => { store().moveScene(only.id, c2.id, 0); });
    expect(chapterById(c1.id)!.scenes.map((x) => x.id)).toEqual([only.id]);
    expect(chapterById(c2.id)!.scenes).toHaveLength(1);
  });
  it("ignores an unknown scene id", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    const before = chapterById(c.id)!.scenes;
    act(() => { store().moveScene("sc_missing", c.id, 0); });
    expect(chapterById(c.id)!.scenes).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id);
    const b = makeChapter(m.id);
    makeScene(a.id);
    const t1 = store().projects[0].updatedAt;
    act(() => { store().moveScene(a.scenes[0].id, b.id, 0); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("moveChapterTo", () => {
  it("moves the chapter into a part and renumbers the plan", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id, "Um");
    const b = makeChapter(m.id, "Dois");
    const c = makeChapter(m.id, "Três");
    const part = makePart(m.id, "P1");
    act(() => { store().moveChapterTo(c.id, part.id, 0); });
    const byId = new Map(chaptersOf(m.id).map((x) => [x.id, x]));
    expect(byId.get(c.id)?.partId).toBe(part.id);
    expect(byId.get(c.id)?.order).toBe(2);
    expect(byId.get(a.id)?.order).toBe(0);
    expect(byId.get(b.id)?.order).toBe(1);
  });

  it("moves the chapter back to the ungrouped run", () => {
    const m = makeManuscript();
    makeChapter(m.id, "Um");
    const part = makePart(m.id, "P1");
    const b = makeChapter(m.id, "Dois");
    act(() => { store().moveChapterTo(b.id, part.id, 0); });
    act(() => { store().moveChapterTo(b.id, undefined, 1); });
    const byId = new Map(chaptersOf(m.id).map((x) => [x.id, x]));
    expect(byId.get(b.id)?.partId).toBeUndefined();
    expect(byId.get(b.id)?.order).toBe(1);
  });

  it("clamps an out-of-range index to the end of the target run", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id, "Um");
    makeChapter(m.id, "Dois");
    makePart(m.id, "P1");
    makeChapter(m.id, "Três");
    act(() => { store().moveChapterTo(a.id, undefined, 9); });
    const byId = new Map(chaptersOf(m.id).map((x) => [x.id, x]));
    expect(byId.get(a.id)?.order).toBe(2);
  });

  it("ignores an unknown chapter id", () => {
    const m = makeManuscript();
    makeChapter(m.id);
    const before = chaptersOf(m.id).slice();
    act(() => { store().moveChapterTo("ch_missing", undefined, 0); });
    expect(chaptersOf(m.id)).toEqual(before);
  });

  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id);
    makeChapter(m.id);
    const t1 = store().projects[0].updatedAt;
    act(() => { store().moveChapterTo(a.id, undefined, 1); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("addPart", () => {
  it("creates with default title, pt_ id and order 1 on an empty book", () => {
    const m = makeManuscript();
    const p = makePart(m.id);
    expect(p.id).toMatch(/^pt_/);
    expect(p.title).toBe("Untitled Part");
    expect(p.order).toBe(1);
    expect(partsOf(m.id)).toHaveLength(1);
  });
  it("orders max(orders)+1", () => {
    const m = makeManuscript();
    makePart(m.id, "A");
    const b = makePart(m.id, "B");
    expect(b.order).toBe(2);
  });
  it("returns null for an unknown manuscript", () => {
    let p: Part | null = null;
    act(() => { p = store().addPart("man_missing"); });
    expect(p).toBeNull();
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const t1 = store().projects[0].updatedAt;
    makePart(m.id);
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("renamePart", () => {
  it("applies the new title", () => {
    const m = makeManuscript();
    const p = makePart(m.id, "Velha");
    act(() => { store().renamePart(p.id, "Nova"); });
    expect(partsOf(m.id).find((x) => x.id === p.id)?.title).toBe("Nova");
  });
  it("ignores an unknown id", () => {
    const m = makeManuscript();
    makePart(m.id, "Velha");
    const before = partsOf(m.id).slice();
    act(() => { store().renamePart("pt_missing", "Nova"); });
    expect(partsOf(m.id)).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const p = makePart(m.id, "Velha");
    const t1 = store().projects[0].updatedAt;
    act(() => { store().renamePart(p.id, "Nova"); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("reorderPartTo", () => {
  it("splices the part at the new index and renumbers 1-based", () => {
    const m = makeManuscript();
    const a = makePart(m.id, "A");
    makePart(m.id, "B");
    const c = makePart(m.id, "C");
    act(() => { store().reorderPartTo(c.id, 0); });
    expect([...partsOf(m.id)].sort((x, y) => x.order - y.order).map((p) => p.title)).toEqual(["C", "A", "B"]);
    expect(partsOf(m.id).find((p) => p.id === a.id)?.order).toBe(2);
  });
  it("clamps out-of-range indexes to the end", () => {
    const m = makeManuscript();
    const a = makePart(m.id, "A");
    makePart(m.id, "B");
    act(() => { store().reorderPartTo(a.id, 7); });
    expect([...partsOf(m.id)].sort((x, y) => x.order - y.order).map((p) => p.title)).toEqual(["B", "A"]);
  });
  it("ignores an unknown part id", () => {
    const m = makeManuscript();
    makePart(m.id, "A");
    const before = partsOf(m.id).slice();
    act(() => { store().reorderPartTo("pt_missing", 1); });
    expect(partsOf(m.id)).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    makePart(m.id, "A");
    const b = makePart(m.id, "B");
    const t1 = store().projects[0].updatedAt;
    act(() => { store().reorderPartTo(b.id, 0); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("replaceChapterBody (docx import)", () => {
  it("replaces all scenes with one scene holding the imported html", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    makeScene(c.id);
    makeScene(c.id);
    act(() => { store().replaceChapterBody(c.id, "<p>Importado do Word.</p>"); });
    const scenes = chapterById(c.id)!.scenes;
    expect(scenes).toHaveLength(1);
    expect(scenes[0].content).toBe("<p>Importado do Word.</p>");
    expect(scenes[0].id).toMatch(/^sc_/);
  });
  it("ignores an unknown chapter id", () => {
    const before = useScriptorium.getState().manuscripts.slice();
    act(() => { store().replaceChapterBody("ch_missing", "<p>x</p>"); });
    expect(store().manuscripts).toEqual(before);
  });
});

describe("removePart", () => {
  it("releases its chapters instead of deleting them", () => {
    const m = makeManuscript();
    let part!: Part, ch!: Chapter;
    act(() => {
      const s = store();
      part = s.addPart(m.id, "Parte Um")!;
      ch = s.addChapter(m.id, "Um")!;
      s.setChapterPart(ch.id, part.id);
      s.removePart(part.id);
    });
    const after = useScriptorium.getState().manuscripts.find((x) => x.id === m.id)!;
    expect(after.parts?.some((p) => p.id === part.id)).toBe(false);
    expect(after.chapters.find((c) => c.id === ch.id)?.partId).toBeUndefined();
  });
  it("leaves the remaining parts untouched (order gap, no renumbering)", () => {
    const m = makeManuscript();
    const a = makePart(m.id, "A");
    const b = makePart(m.id, "B");
    const c = makePart(m.id, "C");
    act(() => { store().removePart(b.id); });
    const left = partsOf(m.id);
    expect(left.map((p) => p.id)).toEqual([a.id, c.id]);
    expect(left.map((p) => p.order)).toEqual([1, 3]);
  });
  it("ignores an unknown id", () => {
    const before = useScriptorium.getState().manuscripts.slice();
    act(() => { store().removePart("pt_missing"); });
    expect(store().manuscripts).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const p = makePart(m.id, "A");
    const t1 = store().projects[0].updatedAt;
    act(() => { store().removePart(p.id); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("setChapterPart", () => {
  it("assigns the chapter to a part", () => {
    const m = makeManuscript();
    const p = makePart(m.id, "A");
    const ch = makeChapter(m.id, "Um");
    act(() => { store().setChapterPart(ch.id, p.id); });
    expect(chaptersOf(m.id).find((c) => c.id === ch.id)?.partId).toBe(p.id);
  });
  it("clears partId when the part is omitted", () => {
    const m = makeManuscript();
    const p = makePart(m.id, "A");
    const ch = makeChapter(m.id, "Um");
    act(() => {
      store().setChapterPart(ch.id, p.id);
      store().setChapterPart(ch.id);
    });
    expect(chaptersOf(m.id).find((c) => c.id === ch.id)?.partId).toBeUndefined();
  });
  it("ignores an unknown chapter id", () => {
    const before = useScriptorium.getState().manuscripts.slice();
    act(() => { store().setChapterPart("ch_missing", "pt_any"); });
    expect(store().manuscripts).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const p = makePart(m.id, "A");
    const ch = makeChapter(m.id, "Um");
    const t1 = store().projects[0].updatedAt;
    act(() => { store().setChapterPart(ch.id, p.id); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("schema integrity", () => {
  it("validateProjectData holds after a full manuscript CRUD chain", () => {
    act(() => {
      const s = store();
      const m = makeManuscript("Livro");
      s.setManuscriptAuthor(m.id, "Autora");
      const c1 = s.addChapter(m.id, "Um");
      expect(c1).toBeTruthy();
      s.addChapter(m.id, "Dois");
      s.updateScene(c1!.scenes[0].id, { content: "Texto" });
      s.addScene(c1!.id);
      s.moveScene(c1!.scenes[0].id, c1!.id, 1);
      s.moveChapterTo(c1!.id, undefined, 1);
      s.deleteManuscript(m.id);
    });
    expect(validateProjectData(useScriptorium.getState())).toBe(true);
  });
  it("exported data validates after operations", () => {
    const m = makeManuscript("Livro");
    const c = makeChapter(m.id);
    act(() => { store().updateScene(c.scenes[0].id, { content: "Texto" }); });
    expect(validateProjectData(JSON.parse(store().exportData()))).toBe(true);
  });
});
