import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useScriptorium } from "./store";
import { validateProjectData } from "./schema";
import type { Chapter, Manuscript, Part, Project } from "../domain/types";

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

function chaptersOf(id: string): Chapter[] {
  return useScriptorium.getState().manuscripts.find((m) => m.id === id)!.chapters;
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
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
  it("ignores an unknown id", () => {
    const before = store().manuscripts.slice();
    act(() => { store().deleteManuscript("man_missing"); });
    expect(store().manuscripts).toEqual(before);
  });
});

describe("addChapter", () => {
  it("creates with default heading, empty content and order 0 on an empty book", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id);
    expect(c.id).toMatch(/^ch_/);
    expect(c.heading).toBe("Untitled Chapter");
    expect(c.content).toBe("");
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
    act(() => { store().updateChapter(c.id, { heading: "Um novo", content: "Texto" }); });
    const stored = chaptersOf(m.id).find((x) => x.id === c.id)!;
    expect(stored.heading).toBe("Um novo");
    expect(stored.content).toBe("Texto");
    expect(stored.id).toBe(c.id);
    expect(stored.order).toBe(0);
  });
  it("clones the patch so later mutation cannot alias into the store", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id, "Um");
    const patch: Partial<Omit<Chapter, "id">> = { content: "rascunho" };
    act(() => { store().updateChapter(c.id, patch); });
    patch.content = "mutado";
    expect(chaptersOf(m.id).find((x) => x.id === c.id)?.content).toBe("rascunho");
  });
  it("ignores an unknown id", () => {
    const before = useScriptorium.getState().manuscripts.slice();
    act(() => { store().updateChapter("ch_missing", { content: "X" }); });
    expect(store().manuscripts).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const c = makeChapter(m.id, "Um");
    const t1 = store().projects[0].updatedAt;
    act(() => { store().updateChapter(c.id, { content: "novo" }); });
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

describe("moveChapter", () => {
  it("dir +1 swaps order with the next chapter in the middle", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id, "Um");
    const b = makeChapter(m.id, "Dois");
    const c = makeChapter(m.id, "Três");
    act(() => { store().moveChapter(a.id, 1); });
    const orders = new Map(chaptersOf(m.id).map((x) => [x.id, x.order]));
    expect(orders.get(a.id)).toBe(b.order);
    expect(orders.get(b.id)).toBe(a.order);
    expect(orders.get(c.id)).toBe(c.order);
  });
  it("dir -1 swaps order with the previous chapter in the middle", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id, "Um");
    const b = makeChapter(m.id, "Dois");
    makeChapter(m.id, "Três");
    act(() => { store().moveChapter(b.id, -1); });
    const orders = new Map(chaptersOf(m.id).map((x) => [x.id, x.order]));
    expect(orders.get(b.id)).toBe(a.order);
    expect(orders.get(a.id)).toBe(1);
  });
  it("is a no-op at the first edge (dir -1)", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id, "Um");
    const b = makeChapter(m.id, "Dois");
    act(() => { store().moveChapter(a.id, -1); });
    const orders = new Map(chaptersOf(m.id).map((x) => [x.id, x.order]));
    expect(orders.get(a.id)).toBe(0);
    expect(orders.get(b.id)).toBe(1);
  });
  it("is a no-op at the last edge (dir +1)", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id, "Um");
    const b = makeChapter(m.id, "Dois");
    act(() => { store().moveChapter(b.id, 1); });
    const orders = new Map(chaptersOf(m.id).map((x) => [x.id, x.order]));
    expect(orders.get(a.id)).toBe(0);
    expect(orders.get(b.id)).toBe(1);
  });
  it("ignores an unknown chapter id", () => {
    const before = useScriptorium.getState().manuscripts.slice();
    act(() => { store().moveChapter("ch_missing", 1); });
    expect(store().manuscripts).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const m = makeManuscript();
    const a = makeChapter(m.id, "Um");
    makeChapter(m.id, "Dois");
    const t1 = store().projects[0].updatedAt;
    act(() => { store().moveChapter(a.id, 1); });
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

describe("reorderPart", () => {
  it("swaps order with the neighbour", () => {
    const m = makeManuscript();
    const a = makePart(m.id, "A");
    const b = makePart(m.id, "B");
    act(() => { store().reorderPart(b.id, -1); });
    const sorted = [...partsOf(m.id)].sort((x, y) => x.order - y.order).map((p) => p.title);
    expect(sorted).toEqual(["B", "A"]);
    expect(partsOf(m.id).find((p) => p.id === a.id)?.order).toBe(2);
  });
  it("dir +1 swaps order with the next part", () => {
    const m = makeManuscript();
    const a = makePart(m.id, "A");
    const b = makePart(m.id, "B");
    makePart(m.id, "C");
    act(() => { store().reorderPart(a.id, 1); });
    const orders = new Map(partsOf(m.id).map((p) => [p.id, p.order]));
    expect(orders.get(a.id)).toBe(2);
    expect(orders.get(b.id)).toBe(1);
  });
  it("is a no-op at the edges", () => {
    const m = makeManuscript();
    const a = makePart(m.id, "A");
    const b = makePart(m.id, "B");
    act(() => { store().reorderPart(a.id, -1); store().reorderPart(b.id, 1); });
    const orders = new Map(partsOf(m.id).map((p) => [p.id, p.order]));
    expect(orders.get(a.id)).toBe(1);
    expect(orders.get(b.id)).toBe(2);
  });
  it("ignores an unknown part id", () => {
    const m = makeManuscript();
    makePart(m.id, "A");
    const before = partsOf(m.id).slice();
    act(() => { store().reorderPart("pt_missing", 1); });
    expect(partsOf(m.id)).toEqual(before);
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
      s.updateChapter(c1!.id, { content: "Texto" });
      s.moveChapter(c1!.id, 1);
      s.deleteManuscript(m.id);
    });
    expect(validateProjectData(useScriptorium.getState())).toBe(true);
  });
  it("exported data validates after operations", () => {
    makeManuscript("Livro");
    expect(validateProjectData(JSON.parse(store().exportData()))).toBe(true);
  });
});
