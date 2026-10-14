import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { useScriptorium } from "./store";
import { STORE_KEY } from "./storage";
import { validateProjectData } from "./schema";
import type { Project, WorldEntry } from "../domain/types";

const store = () => useScriptorium.getState();
const DATA_URL = "data:image/png;base64,AAA";

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

function makeProject(): Project {
  let p!: Project;
  act(() => { p = store().addProject("Reino"); });
  return p;
}

function makeEntry(category: WorldEntry["category"] = "lore"): WorldEntry {
  const project = makeProject();
  let entry!: WorldEntry;
  act(() => { entry = store().addEntry(project.id, category); });
  return entry;
}

describe("addEntry", () => {
  it("creates entry with title \"Sem título\" and default category lore", () => {
    const project = makeProject();
    let entry!: WorldEntry;
    act(() => { entry = store().addEntry(project.id); });
    expect(entry.id).toMatch(/^ent_/);
    expect(entry.projectId).toBe(project.id);
    expect(entry.title).toBe("Sem título");
    expect(entry.category).toBe("lore");
    expect(entry.body).toBe("");
    expect(entry.links).toEqual([]);
    expect(store().entries).toHaveLength(1);
  });
  it("accepts an explicit category", () => {
    const project = makeProject();
    let entry!: WorldEntry;
    act(() => { entry = store().addEntry(project.id, "person"); });
    expect(entry.category).toBe("person");
  });
  it("bumps project updatedAt", () => {
    const project = makeProject();
    const t1 = project.updatedAt;
    act(() => { store().addEntry(project.id); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("updateEntry", () => {
  it("applies the patch", () => {
    const entry = makeEntry();
    act(() => { store().updateEntry(entry.id, { title: "Rainha", body: "História", category: "person" }); });
    const updated = store().entries[0];
    expect(updated.title).toBe("Rainha");
    expect(updated.body).toBe("História");
    expect(updated.category).toBe("person");
  });
  it("clones arrays in the patch so later mutation cannot alias into the store", () => {
    const entry = makeEntry();
    const links = ["ent_x"];
    act(() => { store().updateEntry(entry.id, { links }); });
    links.push("ent_y");
    expect(store().entries[0].links).toEqual(["ent_x"]);
  });
  it("ignores an unknown id", () => {
    const before = store().entries.slice();
    act(() => { store().updateEntry("ent_missing", { title: "X" }); });
    expect(store().entries).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const { entry, project } = { entry: makeEntry(), project: useScriptorium.getState().projects[0] };
    const t1 = project.updatedAt;
    act(() => { store().updateEntry(entry.id, { body: "novo" }); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("deleteEntry", () => {
  it("removes the entry and releases its imageKey", () => {
    const entry = makeEntry();
    act(() => {
      useScriptorium.setState(() => ({
        entries: [{ ...entry, imageKey: "img_entry_old" }],
        images: { img_entry_old: DATA_URL, img_entry_keep: "data:image/png;base64,BBB" },
      }));
    });
    act(() => { store().deleteEntry(entry.id); });
    const s = store();
    expect(s.entries).toHaveLength(0);
    expect(s.images.img_entry_old).toBeUndefined();
    expect(s.images.img_entry_keep).toBe("data:image/png;base64,BBB");
  });
  it("strips the id from every other entry's links", () => {
    const entry = makeEntry("person");
    let b!: WorldEntry;
    act(() => { b = store().addEntry(useScriptorium.getState().projects[0].id, "place"); });
    act(() => {
      useScriptorium.setState((s) => ({
        entries: s.entries.map((e) => (e.id === b.id ? { ...e, links: [entry.id, "ent_ghost"] } : e)),
      }));
    });
    act(() => { store().deleteEntry(entry.id); });
    expect(store().entries.find((e) => e.id === b.id)?.links).toEqual(["ent_ghost"]);
  });
  it("ignores an unknown id", () => {
    const before = store().entries.slice();
    act(() => { store().deleteEntry("ent_missing"); });
    expect(store().entries).toEqual(before);
  });
  it("bumps project updatedAt", () => {
    const entry = makeEntry();
    const t1 = store().projects[0].updatedAt;
    act(() => { store().deleteEntry(entry.id); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("linkEntries", () => {
  it("adds to FROM.links only, never the target's links", () => {
    const project = makeProject();
    let a!: WorldEntry;
    let b!: WorldEntry;
    act(() => { a = store().addEntry(project.id, "person"); });
    act(() => { b = store().addEntry(project.id, "place"); });
    act(() => { store().linkEntries(a.id, b.id); });
    expect(store().entries.find((e) => e.id === a.id)?.links).toEqual([b.id]);
    expect(store().entries.find((e) => e.id === b.id)?.links).toEqual([]);
  });
  it("dedupes: a second identical link is a no-op", () => {
    const project = makeProject();
    let a!: WorldEntry;
    let b!: WorldEntry;
    act(() => { a = store().addEntry(project.id); });
    act(() => { b = store().addEntry(project.id); });
    act(() => { store().linkEntries(a.id, b.id); });
    act(() => { store().linkEntries(a.id, b.id); });
    expect(store().entries.find((e) => e.id === a.id)?.links).toEqual([b.id]);
  });
  it("ignores unknown ids on either side", () => {
    const project = makeProject();
    let a!: WorldEntry;
    act(() => { a = store().addEntry(project.id); });
    act(() => { store().linkEntries(a.id, "ent_missing"); });
    act(() => { store().linkEntries("ent_missing", a.id); });
    expect(store().entries.find((e) => e.id === a.id)?.links).toEqual([]);
  });
  it("bumps project updatedAt", () => {
    const project = makeProject();
    let a!: WorldEntry;
    let b!: WorldEntry;
    act(() => { a = store().addEntry(project.id); });
    act(() => { b = store().addEntry(project.id); });
    const t1 = store().projects[0].updatedAt;
    act(() => { store().linkEntries(a.id, b.id); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("unlinkEntries", () => {
  it("removes the link from FROM.links", () => {
    const project = makeProject();
    let a!: WorldEntry;
    let b!: WorldEntry;
    act(() => { a = store().addEntry(project.id); });
    act(() => { b = store().addEntry(project.id); });
    act(() => { store().linkEntries(a.id, b.id); });
    act(() => { store().unlinkEntries(a.id, b.id); });
    expect(store().entries.find((e) => e.id === a.id)?.links).toEqual([]);
  });
  it("does nothing when the link is absent", () => {
    const project = makeProject();
    let a!: WorldEntry;
    let b!: WorldEntry;
    act(() => { a = store().addEntry(project.id); });
    act(() => { b = store().addEntry(project.id); });
    act(() => { store().unlinkEntries(a.id, b.id); });
    expect(store().entries.find((e) => e.id === a.id)?.links).toEqual([]);
  });
});

describe("putEntryImage", () => {
  it("returns false for an unknown entry", () => {
    expect(store().putEntryImage("ent_missing", DATA_URL)).toBe(false);
  });
  it("assigns an img_entry_ key and the payload persists read-back", () => {
    const entry = makeEntry();
    let ok = false;
    act(() => { ok = store().putEntryImage(entry.id, DATA_URL); });
    expect(ok).toBe(true);
    const imageKey = store().entries[0].imageKey!;
    expect(imageKey).toMatch(/^img_entry_/);
    expect(store().images[imageKey]).toBe(DATA_URL);
    const doc = JSON.parse(localStorage.getItem(STORE_KEY)!) as {
      state: { images: Record<string, string> };
    };
    expect(doc.state.images[imageKey]).toBe(DATA_URL);
  });
  it("swaps the cover and releases the previous key", () => {
    const entry = makeEntry();
    act(() => { store().putEntryImage(entry.id, DATA_URL); });
    const oldKey = store().entries[0].imageKey!;
    let ok = false;
    act(() => { ok = store().putEntryImage(entry.id, "data:image/png;base64,BBB"); });
    expect(ok).toBe(true);
    const s = store();
    const newKey = s.entries[0].imageKey!;
    expect(newKey).toMatch(/^img_entry_/);
    expect(newKey).not.toBe(oldKey);
    expect(s.images[newKey]).toBe("data:image/png;base64,BBB");
    expect(s.images[oldKey]).toBeUndefined();
  });
  it("keeps the previous key while another entry still references it", () => {
    const project = makeProject();
    let a!: WorldEntry;
    let b!: WorldEntry;
    act(() => { a = store().addEntry(project.id); });
    act(() => { b = store().addEntry(project.id); });
    act(() => { store().putEntryImage(a.id, DATA_URL); });
    const sharedKey = store().entries.find((e) => e.id === a.id)!.imageKey!;
    act(() => {
      useScriptorium.setState((s) => ({
        entries: s.entries.map((e) => (e.id === b.id ? { ...e, imageKey: sharedKey } : e)),
      }));
    });
    act(() => { store().putEntryImage(a.id, "data:image/png;base64,BBB"); });
    expect(store().images[sharedKey]).toBe(DATA_URL);
  });
  it("bumps project updatedAt", () => {
    const entry = makeEntry();
    const t1 = store().projects[0].updatedAt;
    act(() => { store().putEntryImage(entry.id, DATA_URL); });
    expect(store().projects[0].updatedAt).toBeGreaterThanOrEqual(t1);
  });
});

describe("schema integrity", () => {
  it("validateProjectData holds after a full entry CRUD chain", () => {
    const entry = makeEntry("faction");
    act(() => {
      const s = store();
      const b = s.addEntry(s.projects[0].id, "item");
      s.putEntryImage(entry.id, DATA_URL);
      s.linkEntries(entry.id, b.id);
      s.updateEntry(entry.id, { body: "# Título\n\nTexto" });
      s.unlinkEntries(entry.id, b.id);
      s.deleteEntry(b.id);
    });
    expect(validateProjectData(useScriptorium.getState())).toBe(true);
  });
});
