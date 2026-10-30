import { beforeEach, describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { selectHistoryFlags, selectCounts, useWriteme } from "./store";
import { localStoragePersistence, STORE_KEY, flushPendingPersist } from "./storage";
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
  useWriteme.setState(useWriteme.getInitialState());
});

describe("project CRUD", () => {
  it("adds a project with defaults", () => {
    let created!: Project;
    act(() => { created = useWriteme.getState().addProject("Shimradis"); });
    expect(created.name).toBe("Shimradis");
    expect(created.id).toMatch(/^prj_/);
    expect(created.description).toBe("");
    const s = useWriteme.getState();
    expect(s.projects).toHaveLength(1);
  });
  it("updates name and bumps updatedAt", () => {
    let p!: Project;
    act(() => { p = useWriteme.getState().addProject("Old"); });
    const t1 = p.updatedAt;
    act(() => { useWriteme.getState().updateProject(p.id, { name: "New" }); });
    const s = useWriteme.getState().projects[0];
    expect(s.name).toBe("New");
    expect(s.updatedAt).toBeGreaterThanOrEqual(t1);
  });
  it("delete cascades into entries, atlases, manuscripts and images", () => {
    let p!: Project;
    act(() => { p = useWriteme.getState().addProject("X"); });
    act(() => {
      useWriteme.setState((s) => ({
        ...s,
        entries: [{ id: "ent_1", projectId: p.id, title: "T", category: "lore", body: "", links: [], imageKey: "k_entry" }],
        atlases: [{ id: "atl_1", projectId: p.id, name: "Mapa", regions: [], pins: [], mapImageKey: "k_map" }],
        manuscripts: [{ id: "man_1", projectId: p.id, title: "Livro", author: "", chapters: [] }],
        images: { k_entry: "data:image/png;base64,AAA", k_map: "data:image/png;base64,BBB", k_other: "data:image/png;base64,CCC" },
      }));
    });
    act(() => { useWriteme.getState().deleteProject(p.id); });
    const s = useWriteme.getState();
    expect(s.projects).toHaveLength(0);
    expect(s.entries).toHaveLength(0);
    expect(s.atlases).toHaveLength(0);
    expect(s.manuscripts).toHaveLength(0);
    expect(Object.keys(s.images)).toEqual(["k_other"]);
  });
  it("deleteProject drops history keys for the deleted project's atlases", () => {
    let p!: Project;
    act(() => { p = useWriteme.getState().addProject("H"); });
    act(() => {
      useWriteme.setState((st) => ({
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
    act(() => { useWriteme.getState().deleteProject(p.id); });
    expect(Object.keys(useWriteme.getState().histories)).toEqual(["atl_keep"]);
  });
  it("seedDemo materializes demo data, flips seedFlag, returns project id", () => {
    let id: string | null = null;
    act(() => { id = useWriteme.getState().seedDemo(); });
    const s = useWriteme.getState();
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
    act(() => void useWriteme.persist.rehydrate());
    const toasts = useWriteme.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].kind).toBe("info");
    expect(toasts[0].message).toBe("Corrupted data was preserved in a backup; the app opened empty.");
  });
  it("does not toast on hydrate with clean storage", () => {
    localStorage.removeItem(STORE_KEY);
    act(() => void useWriteme.persist.rehydrate());
    expect(useWriteme.getState().toasts).toHaveLength(0);
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
    localStorage.setItem("writeme.corrupt.2026-01-01T00:00:00.000Z", "{old");
    act(() => void useWriteme.persist.rehydrate());
    expect(useWriteme.getState().toasts).toHaveLength(0);
  });
});

describe("persist + corruption", () => {
  it("opens with clean empty state when no payload is stored", () => {
    localStorage.removeItem(STORE_KEY);
    expect(localStoragePersistence.getItem(STORE_KEY)).toBeNull();
    expect(useWriteme.getState().projects).toHaveLength(0);
  });
  it("persists a valid doc through actions (write path proof)", () => {
    act(() => { useWriteme.getState().addProject("Persistida"); });
    flushPendingPersist();
    const raw = localStorage.getItem(STORE_KEY);
    expect(raw).toBeTruthy();
    const doc = JSON.parse(raw!) as { state: { projects: unknown[] }; version: number };
    expect(doc.state.projects).toHaveLength(1);
    expect(doc.version).toBe(1);
  });
  it("adapter reads back a { state, version: 1 } shaped value for a valid doc", () => {
    act(() => { useWriteme.getState().addProject("Adaptador"); });
    flushPendingPersist();
    const doc = localStoragePersistence.getItem(STORE_KEY) as unknown as {
      state: { projects: { name: string }[]; seedFlag: boolean };
      version: number;
    };
    expect(doc.state.projects.map((p) => p.name)).toEqual(["Adaptador"]);
    expect(doc.state.seedFlag).toBe(false);
    expect(doc.version).toBe(1);
  });
  it("moves raw corrupt payload to a backup key and adapter returns falsy", () => {
    const corrupt = "{not json at all";
    localStorage.setItem(STORE_KEY, corrupt);
    expect(localStoragePersistence.getItem(STORE_KEY)).toBeFalsy();
    const keys = storageKeys().filter((k) => k.startsWith("writeme.corrupt."));
    expect(keys).toHaveLength(1);
    expect(localStorage.getItem(keys[0])).toBe(corrupt);
  });
  it("shape-invalid payload is backed up too", () => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ state: { projects: "nope" }, version: 0 }));
    expect(localStoragePersistence.getItem(STORE_KEY)).toBeFalsy();
    const keys = storageKeys().filter((k) => k.startsWith("writeme.corrupt."));
    expect(keys).toHaveLength(1);
  });
  it("import rejects invalid payloads without touching state", () => {
    const before = useWriteme.getState().projects.slice();
    const r = useWriteme.getState().importData("{oops");
    expect(r.ok).toBe(false);
    expect(useWriteme.getState().projects).toEqual(before);
  });
  it("export/import round-trips through importData", () => {
    act(() => { useWriteme.getState().addProject("Rt"); });
    const json = useWriteme.getState().exportData();
    act(() => {
      localStorage.clear();
      useWriteme.setState(useWriteme.getInitialState());
      expect(useWriteme.getState().importData(json).ok).toBe(true);
    });
    expect(useWriteme.getState().projects[0].name).toBe("Rt");
  });
  it("importData clears histories: same-id re-import cannot undo into replaced data", () => {
    let p!: Project;
    let atlasId = "";
    let json = "";
    act(() => {
      p = useWriteme.getState().addProject("Rt");
      const a = useWriteme.getState().addAtlas(p.id, "M");
      atlasId = a.id;
      useWriteme.getState().addRegion(atlasId, {
        points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
      });
      json = useWriteme.getState().exportData();
    });
    expect(selectHistoryFlags(atlasId)(useWriteme.getState())).toEqual({ canUndo: true, canRedo: false });
    expect(useWriteme.getState().importData(json).ok).toBe(true);
    const s = useWriteme.getState();
    expect(Object.keys(s.histories)).toHaveLength(0);
    expect(selectHistoryFlags(atlasId)(s)).toEqual({ canUndo: false, canRedo: false });
  });
  it("resetAll wipes storage and state including seedFlag", () => {
    act(() => { useWriteme.getState().addProject("R"); });
    act(() => { useWriteme.getState().resetAll(); });
    expect(useWriteme.getState().projects).toHaveLength(0);
    expect(useWriteme.getState().seedFlag).toBe(false);
    flushPendingPersist();
    const doc = JSON.parse(localStorage.getItem(STORE_KEY)!) as { state: { projects: unknown[]; seedFlag: boolean } };
    expect(doc.state.projects).toHaveLength(0);
    expect(doc.state.seedFlag).toBe(false);
  });
});

describe("toasts and images", () => {
  it("pushes and dismisses toasts", () => {
    let id!: string;
    act(() => { id = useWriteme.getState().pushToast("success", "Feito"); });
    expect(useWriteme.getState().toasts).toHaveLength(1);
    act(() => { useWriteme.getState().dismissToast(id); });
    expect(useWriteme.getState().toasts).toHaveLength(0);
  });
  it("putImage returns stable key and removeImage deletes it", () => {
    let key!: string;
    act(() => { key = useWriteme.getState().putImage("data:image/png;base64,AAA", "cover"); });
    expect(key).toMatch(/^img_cover_/);
    expect(useWriteme.getState().images[key]).toBe("data:image/png;base64,AAA");
    act(() => { useWriteme.getState().removeImage(key); });
    expect(useWriteme.getState().images[key]).toBeUndefined();
  });
});
describe("deleteProject cascade", () => {
  it("removes all 8 subsystems when the project dies", () => {
    act(() => { useWriteme.getState().seedDemo(); });
    const st1 = useWriteme.getState();
    const pid = st1.projects[0].id;
    act(() => { useWriteme.getState().deleteProject(pid); });
    const st = useWriteme.getState();
    expect(st.projects).toHaveLength(0);
    expect(st.bloodlines).toHaveLength(0);
    expect(st.factionWebs).toHaveLength(0);
    expect(st.calendars).toHaveLength(0);
    expect(st.plotBoards).toHaveLength(0);
    expect(st.timelines).toHaveLength(0);
    expect(st.oathsCharts).toHaveLength(0);
    expect(st.wellsprings).toHaveLength(0);
    expect(st.conlangs).toHaveLength(0);
  });
  it("keeps another seeded project's subsystems intact", () => {
    act(() => { useWriteme.getState().seedDemo(); });
    act(() => { useWriteme.getState().seedDemo(); });
    const victims = useWriteme.getState().projects;
    const pid = victims[0].id;
    act(() => { useWriteme.getState().deleteProject(pid); });
    const st = useWriteme.getState();
    const survivor = st.projects[0].id;
    expect(st.projects).toHaveLength(1);
    expect(st.bloodlines).toHaveLength(1);
    expect(st.bloodlines[0].projectId).toBe(survivor);
    expect(st.calendars).toHaveLength(1);
    expect(st.calendars![0].projectId).toBe(survivor);
    expect(st.conlangs).toHaveLength(1);
  });
});

describe("seedDemo full subsystems", () => {
  it("persists every subsystem from the demo seed", () => {
    act(() => { useWriteme.getState().seedDemo(); });
    const s = useWriteme.getState();
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
  it("appends a full second copy on a second seed", () => {
    act(() => {
      useWriteme.getState().seedDemo();
      useWriteme.getState().seedDemo();
    });
    const s = useWriteme.getState();
    expect(s.bloodlines).toHaveLength(2);
    expect(s.calendars).toHaveLength(2);
  });
});
describe("selectCounts full subsystems", () => {
  it("counts the demo world across every forge", () => {
    act(() => { useWriteme.getState().seedDemo(); });
    const s = useWriteme.getState();
    const pid = s.projects[s.projects.length - 1].id;
    const c = selectCounts(pid)(s);
    expect(c.entries).toBe(16);
    expect(c.chapters).toBe(3);
    expect(c.bloodlinePersons).toBe(6);
    expect(c.oathMembers).toBe(6);
    expect(c.factions).toBe(4);
    expect(c.calendarEvents).toBe(9);
    expect(c.plotCards).toBe(7);
    expect(c.timelineBeads).toBe(7); // 6 events plus the origin bead
    expect(c.wellspringNodes).toBe(8);
    expect(c.conlangWords).toBe(12);
    expect(c.chronologyEvents).toBe(1);
    expect(c.atlasPins).toBeGreaterThanOrEqual(4);
    expect(c.atlasRegions).toBe(3);
  });
});
