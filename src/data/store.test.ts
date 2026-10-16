import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { selectHistoryFlags, selectCounts, useScriptorium } from "./store";
import { localStoragePersistence, STORE_KEY } from "./storage";
import type { Project } from "../domain/types";

function storageKeys(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k !== null) out.push(k);
  }
  return out;
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("project CRUD", () => {
  it("adds a project with defaults", () => {
    let created!: Project;
    act(() => { created = useScriptorium.getState().addProject("Shimradis"); });
    expect(created.name).toBe("Shimradis");
    expect(created.id).toMatch(/^prj_/);
    expect(created.description).toBe("");
    const s = useScriptorium.getState();
    expect(s.projects).toHaveLength(1);
  });
  it("updates name and bumps updatedAt", () => {
    let p!: Project;
    act(() => { p = useScriptorium.getState().addProject("Old"); });
    const t1 = p.updatedAt;
    act(() => { useScriptorium.getState().updateProject(p.id, { name: "New" }); });
    const s = useScriptorium.getState().projects[0];
    expect(s.name).toBe("New");
    expect(s.updatedAt).toBeGreaterThanOrEqual(t1);
  });
  it("delete cascades into entries, atlases, manuscripts and images", () => {
    let p!: Project;
    act(() => { p = useScriptorium.getState().addProject("X"); });
    act(() => {
      useScriptorium.setState((s) => ({
        ...s,
        entries: [{ id: "ent_1", projectId: p.id, title: "T", category: "lore", body: "", links: [], imageKey: "k_entry" }],
        atlases: [{ id: "atl_1", projectId: p.id, name: "Mapa", regions: [], pins: [], mapImageKey: "k_map" }],
        manuscripts: [{ id: "man_1", projectId: p.id, title: "Livro", author: "", chapters: [] }],
        images: { k_entry: "data:image/png;base64,AAA", k_map: "data:image/png;base64,BBB", k_other: "data:image/png;base64,CCC" },
      }));
    });
    act(() => { useScriptorium.getState().deleteProject(p.id); });
    const s = useScriptorium.getState();
    expect(s.projects).toHaveLength(0);
    expect(s.entries).toHaveLength(0);
    expect(s.atlases).toHaveLength(0);
    expect(s.manuscripts).toHaveLength(0);
    expect(Object.keys(s.images)).toEqual(["k_other"]);
  });
  it("deleteProject drops history keys for the deleted project's atlases", () => {
    let p!: Project;
    act(() => { p = useScriptorium.getState().addProject("H"); });
    act(() => {
      useScriptorium.setState((st) => ({
        ...st,
        atlases: [
          { id: "atl_1", projectId: p.id, name: "A", regions: [], pins: [] },
          { id: "atl_keep", projectId: "prj_other", name: "B", regions: [], pins: [] },
        ],
        histories: {
          atl_1: { undo: [{ regions: [], pins: [] }], redo: [] },
          atl_keep: { undo: [{ regions: [], pins: [] }], redo: [] },
        },
      }));
    });
    act(() => { useScriptorium.getState().deleteProject(p.id); });
    expect(Object.keys(useScriptorium.getState().histories)).toEqual(["atl_keep"]);
  });
  it("seedDemo materializes demo data, flips seedFlag, returns project id", () => {
    let id: string | null = null;
    act(() => { id = useScriptorium.getState().seedDemo(); });
    const s = useScriptorium.getState();
    expect(id).toBe(s.projects[0]?.id);
    expect(s.projects).toHaveLength(1);
    expect(s.entries.length).toBeGreaterThanOrEqual(7);
    expect(s.atlases).toHaveLength(1);
    expect(s.manuscripts).toHaveLength(1);
    expect(s.seedFlag).toBe(true);
  });
});

describe("corrupt recovery toast (spec §6)", () => {
  it("pushes an info toast on hydrate when storage opened empty over a corrupt backup", () => {
    localStorage.setItem(STORE_KEY, "{not json at all");
    act(() => void useScriptorium.persist.rehydrate());
    const toasts = useScriptorium.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].kind).toBe("info");
    expect(toasts[0].message).toBe("Corrupted data was preserved in a backup; the app opened empty.");
  });
  it("does not toast on hydrate with clean storage", () => {
    localStorage.removeItem(STORE_KEY);
    act(() => void useScriptorium.persist.rehydrate());
    expect(useScriptorium.getState().toasts).toHaveLength(0);
  });
  it("does not toast on hydrate when restored data is non-empty", () => {
    localStorage.clear();
    const doc = {
      state: {
        projects: [{ id: "prj_a", name: "X", description: "", createdAt: 1, updatedAt: 1 }],
        entries: [], atlases: [], manuscripts: [], images: {}, seedFlag: false,
      },
      version: 1,
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(doc));
    localStorage.setItem("scriptorium.corrupt.2026-01-01T00:00:00.000Z", "{old");
    act(() => void useScriptorium.persist.rehydrate());
    expect(useScriptorium.getState().toasts).toHaveLength(0);
  });
});

describe("persist + corruption", () => {
  it("opens with clean empty state when no payload is stored", () => {
    localStorage.removeItem(STORE_KEY);
    expect(localStoragePersistence.getItem(STORE_KEY)).toBeNull();
    expect(useScriptorium.getState().projects).toHaveLength(0);
  });
  it("persists a valid doc through actions (write path proof)", () => {
    act(() => { useScriptorium.getState().addProject("Persistida"); });
    const raw = localStorage.getItem(STORE_KEY);
    expect(raw).toBeTruthy();
    const doc = JSON.parse(raw!) as { state: { projects: unknown[] }; version: number };
    expect(doc.state.projects).toHaveLength(1);
    expect(doc.version).toBe(2);
  });
  it("adapter reads back a { state, version: 2 } shaped value for a valid doc", () => {
    act(() => { useScriptorium.getState().addProject("Adaptador"); });
    const doc = localStoragePersistence.getItem(STORE_KEY) as unknown as {
      state: { projects: { name: string }[]; seedFlag: boolean };
      version: number;
    };
    expect(doc.state.projects.map((p) => p.name)).toEqual(["Adaptador"]);
    expect(doc.state.seedFlag).toBe(false);
    expect(doc.version).toBe(2);
  });
  it("moves raw corrupt payload to a backup key and adapter returns falsy", () => {
    const corrupt = "{not json at all";
    localStorage.setItem(STORE_KEY, corrupt);
    expect(localStoragePersistence.getItem(STORE_KEY)).toBeFalsy();
    const keys = storageKeys().filter((k) => k.startsWith("scriptorium.corrupt."));
    expect(keys).toHaveLength(1);
    expect(localStorage.getItem(keys[0])).toBe(corrupt);
  });
  it("shape-invalid payload is backed up too", () => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ state: { projects: "nope" }, version: 0 }));
    expect(localStoragePersistence.getItem(STORE_KEY)).toBeFalsy();
    const keys = storageKeys().filter((k) => k.startsWith("scriptorium.corrupt."));
    expect(keys).toHaveLength(1);
  });
  it("import rejects invalid payloads without touching state", () => {
    const before = useScriptorium.getState().projects.slice();
    const r = useScriptorium.getState().importData("{oops");
    expect(r.ok).toBe(false);
    expect(useScriptorium.getState().projects).toEqual(before);
  });
  it("export/import round-trips through importData", () => {
    act(() => { useScriptorium.getState().addProject("Rt"); });
    const json = useScriptorium.getState().exportData();
    act(() => {
      localStorage.clear();
      useScriptorium.setState(useScriptorium.getInitialState());
      expect(useScriptorium.getState().importData(json).ok).toBe(true);
    });
    expect(useScriptorium.getState().projects[0].name).toBe("Rt");
  });
  it("importData clears histories: same-id re-import cannot undo into replaced data", () => {
    let p!: Project;
    let atlasId = "";
    let json = "";
    act(() => {
      p = useScriptorium.getState().addProject("Rt");
      const a = useScriptorium.getState().addAtlas(p.id, "M");
      atlasId = a.id;
      useScriptorium.getState().addRegion(atlasId, {
        points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      });
      json = useScriptorium.getState().exportData();
    });
    expect(selectHistoryFlags(atlasId)(useScriptorium.getState())).toEqual({ canUndo: true, canRedo: false });
    expect(useScriptorium.getState().importData(json).ok).toBe(true);
    const s = useScriptorium.getState();
    expect(Object.keys(s.histories)).toHaveLength(0);
    expect(selectHistoryFlags(atlasId)(s)).toEqual({ canUndo: false, canRedo: false });
  });
  it("resetAll wipes storage and state including seedFlag", () => {
    act(() => { useScriptorium.getState().addProject("R"); });
    act(() => { useScriptorium.getState().resetAll(); });
    expect(useScriptorium.getState().projects).toHaveLength(0);
    expect(useScriptorium.getState().seedFlag).toBe(false);
    const doc = JSON.parse(localStorage.getItem(STORE_KEY)!) as { state: { projects: unknown[]; seedFlag: boolean } };
    expect(doc.state.projects).toHaveLength(0);
    expect(doc.state.seedFlag).toBe(false);
  });
});

describe("toasts and images", () => {
  it("pushes and dismisses toasts", () => {
    let id!: string;
    act(() => { id = useScriptorium.getState().pushToast("success", "Feito"); });
    expect(useScriptorium.getState().toasts).toHaveLength(1);
    act(() => { useScriptorium.getState().dismissToast(id); });
    expect(useScriptorium.getState().toasts).toHaveLength(0);
  });
  it("putImage returns stable key and removeImage deletes it", () => {
    let key!: string;
    act(() => { key = useScriptorium.getState().putImage("data:image/png;base64,AAA", "cover"); });
    expect(key).toMatch(/^img_cover_/);
    expect(useScriptorium.getState().images[key]).toBe("data:image/png;base64,AAA");
    act(() => { useScriptorium.getState().removeImage(key); });
    expect(useScriptorium.getState().images[key]).toBeUndefined();
  });
});
describe("seedDemo full subsystems", () => {
  it("persists every subsystem from the demo seed", () => {
    act(() => { useScriptorium.getState().seedDemo(); });
    const s = useScriptorium.getState();
    expect(s.bloodlines).toHaveLength(1);
    expect(s.factionWebs).toHaveLength(1);
    expect(s.calendars).toHaveLength(1);
    expect(s.plotBoards).toHaveLength(1);
    expect(s.timelines).toHaveLength(1);
    expect(s.oathsCharts).toHaveLength(1);
    expect(s.wellsprings).toHaveLength(1);
    expect(s.conlangs).toHaveLength(1);
    const pid = s.projects[0].id;
    expect(s.bloodlines[0].projectId).toBe(pid);
    expect(s.calendars![0].projectId).toBe(pid);
  });
  it("does not duplicate existing project data across a second seed", () => {
    act(() => {
      useScriptorium.getState().seedDemo();
      useScriptorium.getState().seedDemo();
    });
    const s = useScriptorium.getState();
    expect(s.bloodlines).toHaveLength(2);
    expect(s.calendars).toHaveLength(2);
  });
});
describe("selectCounts full subsystems", () => {
  it("counts the demo world across every forge", () => {
    act(() => { useScriptorium.getState().seedDemo(); });
    const s = useScriptorium.getState();
    const pid = s.projects[s.projects.length - 1].id;
    const c = selectCounts(pid)(s);
    expect(c.entries).toBe(16);
    expect(c.chapters).toBe(3);
    expect(c.bloodlinePersons).toBe(6);
    expect(c.oathMembers).toBe(6);
    expect(c.factions).toBe(4);
    expect(c.calendarEvents).toBe(9);
    expect(c.plotCards).toBe(7);
    expect(c.timelineBeads).toBe(6);
    expect(c.wellspringNodes).toBe(8);
    expect(c.conlangWords).toBe(12);
    expect(c.atlasPins).toBeGreaterThanOrEqual(4);
    expect(c.atlasRegions).toBe(3);
  });
});
