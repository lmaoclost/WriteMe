import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { useScriptorium, selectHistoryFlags } from "./store";
import type { AtlasHistory } from "./store";
import { STORE_KEY, flushPendingPersist } from "./storage";
import { parseExport, validateProjectData } from "./schema";
import type { Atlas, Pin, Region, WorldEntry } from "../domain/types";
import { getLastRegionColor, pushRecentColor, resetRecentColors } from "../features/atlas/panels/recentColors";

const clipState = vi.hoisted(() => ({ fail: false }));
vi.mock("./clip", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./clip")>();
  return {
    ...actual,
    fitGap: (...args: Parameters<typeof actual.fitGap>) => {
      if (clipState.fail) throw new Error("clip boom");
      return actual.fitGap(...args);
    },
    claimRest: (...args: Parameters<typeof actual.claimRest>) => {
      if (clipState.fail) throw new Error("clip boom");
      return actual.claimRest(...args);
    },
  };
});

/**
 * Cases:
 * 1. addAtlas creates empty atlas; deleteAtlas releases its map image; renameAtlas bumps nothing else.
 * 2. putMapImage assigns img_map_* key and frees the previous key.
 * 3. setAtlasMapFromEntry copies the entry image blob copy into a new map key.
 * 4. addRegion defaults (color #3498db, fillOpacity .28, label "") and persists in the atlas; deleteRegion drops it.
 * 5. addPin defaults (type place, color #e74c3c); movePin changes coords; deletePin.
 * 6. pushHistory + undo/redo: addRegion -> pushHistory happened inside action -> undo removes it; redo restores; cap 50.
 * 7. deleteRegion + undo restores region (ids kept; dangling selection is UI-level).
 * 8. claimRemainingArea: original untouched, claimed added as NEW regions, total area preserved.
 * 9. fitRegionIntoGap returns region and adds to atlas; fully covered -> null.
 * 10. exportData parses with parseExport after all ops.
 */

const store = () => useScriptorium.getState();

const frame = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const leftHalf = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }];
const rightHalf = [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }];
const quadrant = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 }];

function areaOf(pts: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  }
  return Math.abs(a / 2);
}

function addAtlas(name = "Mapa"): Atlas {
  let a!: Atlas;
  act(() => { a = store().addAtlas("prj_1", name); });
  return a;
}

function addRegionDirect(atlasId: string, points: { x: number; y: number }[]): Region {
  let r!: Region;
  act(() => { r = store().addRegion(atlasId, { points }) as Region; });
  return r;
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
  resetRecentColors();
  clipState.fail = false;
});

describe("atlas CRUD (case 1)", () => {
  it("addAtlas creates an empty atlas bound to the project; renameAtlas only touches its name", () => {
    const a = addAtlas("Mundo");
    expect(a.id).toMatch(/^atl_/);
    expect(a.projectId).toBe("prj_1");
    expect(a.name).toBe("Mundo");
    expect(a.regions).toEqual([]);
    expect(a.pins).toEqual([]);
    expect(store().atlases).toHaveLength(1);
    const b = addAtlas("B");
    act(() => { store().renameAtlas(a.id, "Mundo2"); });
    const atlases = store().atlases;
    expect(atlases.find((x) => x.id === a.id)?.name).toBe("Mundo2");
    expect(atlases.find((x) => x.id === b.id)?.name).toBe("B");
  });
  it("deleteAtlas releases its map image key", () => {
    const a = addAtlas();
    let ok: boolean | undefined;
    act(() => { ok = store().putMapImage(a.id, "data:image/png;base64,AAA"); });
    expect(ok).toBe(true);
    const key = store().atlases[0].mapImageKey!;
    expect(store().images[key]).toBe("data:image/png;base64,AAA");
    act(() => { store().deleteAtlas(a.id); });
    expect(store().atlases).toHaveLength(0);
    expect(store().images[key]).toBeUndefined();
  });
});

describe("map images (cases 2-3)", () => {
  it("putMapImage assigns img_map_* key and frees the previous key", () => {
    const a = addAtlas();
    let ok1: boolean | undefined;
    let ok2: boolean | undefined;
    act(() => { ok1 = store().putMapImage(a.id, "data:image/png;base64,ONE"); });
    act(() => { ok2 = store().putMapImage(a.id, "data:image/png;base64,TWO"); });
    expect(ok1).toBe(true);
    expect(ok2).toBe(true);
    const atl = store().atlases[0];
    expect(atl.mapImageKey).toMatch(/^img_map_/);
    expect(store().images[atl.mapImageKey!]).toBe("data:image/png;base64,TWO");
    expect(Object.values(store().images).some((v) => v.includes("ONE"))).toBe(false);
  });
  it("durable write failure keeps the map (with the persist toast), doc stays clean", async () => {
    const a = addAtlas();
    const restored = globalThis.indexedDB;
    globalThis.indexedDB = { open: () => { throw new Error("boom"); } } as unknown as typeof globalThis.indexedDB;
    try {
      let ok: boolean | undefined;
      act(() => { ok = store().putMapImage(a.id, "data:image/png;base64,QUOTA_BOMB"); });
      expect(ok).toBe(true);
      await vi.waitFor(() =>
        expect(store().toasts.some((t) => t.kind === "error")).toBe(true),
      );
      expect(store().atlases[0].mapImageKey).toMatch(/^img_map_/);
      expect(Object.values(store().images).some((v) => v.includes("QUOTA_BOMB"))).toBe(true);
    } finally {
      globalThis.indexedDB = restored;
    }
  });
  it("setAtlasMapFromEntry copies the entry image into a new map key", () => {
    const a = addAtlas();
    const entry: WorldEntry = {
      id: "ent_1", projectId: "prj_1", title: "Cidade", category: "place",
      body: "", links: [], imageKey: "img_entry_x",
    };
    act(() => {
      useScriptorium.setState({
        entries: [entry],
        images: { img_entry_x: "data:image/png;base64,CITY" },
      });
    });
    let ok: boolean | undefined;
    act(() => { ok = store().setAtlasMapFromEntry(a.id, "ent_1"); });
    expect(ok).toBe(true);
    const atl = store().atlases[0];
    expect(atl.mapImageKey).toMatch(/^img_map_/);
    expect(store().images[atl.mapImageKey!]).toBe("data:image/png;base64,CITY");
    let missing: boolean | undefined;
    act(() => { missing = store().setAtlasMapFromEntry(a.id, "ent_missing"); });
    expect(missing).toBe(false);
    expect(store().atlases[0].mapImageKey).toBe(atl.mapImageKey);
  });
});

describe("regions (case 4)", () => {
  it("addRegion applies defaults and deleteRegion drops it", () => {
    const a = addAtlas();
    const r = addRegionDirect(a.id, frame);
    expect(r.id).toMatch(/^reg_/);
    expect(r.color).toBe("#3498db");
    expect(r.fillOpacity).toBe(0.28);
    expect(r.label).toBe("");
    expect(store().atlases[0].regions).toHaveLength(1);
    act(() => { store().deleteRegion(r.id); });
    expect(store().atlases[0].regions).toHaveLength(0);
  });
  it("trim guard: degenerate addRegion returns null and degenerate updateRegion patch is ignored", () => {
    const a = addAtlas();
    const r = addRegionDirect(a.id, frame);
    let tooSmall: Region | null = null;
    act(() => { tooSmall = store().addRegion(a.id, { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }); });
    expect(tooSmall).toBeNull();
    act(() => { store().updateRegion(r.id, { points: [{ x: 0, y: 0 }, { x: 0.4, y: 0.4 }, { x: 0.4, y: 0.4 }] }); });
    const kept = store().atlases[0].regions[0];
    expect(kept.points).toHaveLength(4);
    expect(store().atlases[0].regions).toHaveLength(1);
    expect(tooSmall).toBeNull();
  });
});

describe("pins (case 5)", () => {
  it("addPin applies defaults, movePin changes coords, deletePin drops it", () => {
    const a = addAtlas();
    let p!: Pin;
    act(() => { p = store().addPin(a.id, { x: 0.2, y: 0.3 }) as Pin; });
    expect(p.id).toMatch(/^pin_/);
    expect(p.type).toBe("place");
    expect(p.color).toBe("#e74c3c");
    expect(p.label).toBe("");
    act(() => { store().movePin(p.id, 0.8, 0.9); });
    const moved = store().atlases[0].pins[0];
    expect(moved.x).toBe(0.8);
    expect(moved.y).toBe(0.9);
    act(() => { store().deletePin(p.id); });
    expect(store().atlases[0].pins).toHaveLength(0);
  });
});

describe("history (case 6)", () => {
  it("addRegion pushes history: undo removes the region, redo restores it", () => {
    const a = addAtlas();
    const r = addRegionDirect(a.id, frame);
    expect(store().atlases[0].regions).toHaveLength(1);
    act(() => { store().undo(a.id); });
    expect(store().atlases[0].regions).toHaveLength(0);
    let flags!: { canUndo: boolean; canRedo: boolean };
    act(() => { flags = selectHistoryFlags(a.id)(store()); });
    expect(flags).toEqual({ canUndo: false, canRedo: true });
    act(() => { store().redo(a.id); });
    expect(store().atlases[0].regions).toHaveLength(1);
    expect(store().atlases[0].regions[0].id).toBe(r.id);
  });
  it("history is capped at 50 snapshots", () => {
    const a = addAtlas();
    act(() => {
      for (let i = 0; i < 60; i++) {
        store().addPin(a.id, { x: (i % 10) / 10, y: (i % 10) / 10 });
        store().pushHistory(a.id);
      }
    });
    const h = store().histories[a.id];
    expect(h.undo.length).toBe(50);
    const flags = selectHistoryFlags(a.id)(store());
    expect(flags.canUndo).toBe(true);
  });
  it("a new mutation clears the redo stack", () => {
    const a = addAtlas();
    addRegionDirect(a.id, frame);
    act(() => { store().undo(a.id); });
    expect(selectHistoryFlags(a.id)(store()).canRedo).toBe(true);
    addRegionDirect(a.id, leftHalf);
    const flags = selectHistoryFlags(a.id)(store());
    expect(flags.canRedo).toBe(false);
    expect(store().atlases[0].regions).toHaveLength(1);
  });
  it("deleteRegion then undo restores the region with the same id (case 7)", () => {
    const a = addAtlas();
    const r = addRegionDirect(a.id, frame);
    act(() => { store().deleteRegion(r.id); });
    expect(store().atlases[0].regions).toHaveLength(0);
    act(() => { store().undo(a.id); });
    const regions = store().atlases[0].regions;
    expect(regions).toHaveLength(1);
    expect(regions[0].id).toBe(r.id);
    expect(regions[0].points).toEqual(frame);
  });
});

describe("claim remaining area (case 8)", () => {
  it("split leaves the original untouched and preserves total covered area", () => {
    const a = addAtlas();
    const orig = addRegionDirect(a.id, frame);
    addRegionDirect(a.id, rightHalf);
    const beforeUnion = store().atlases[0].regions.reduce((acc, r) => acc + areaOf(r.points), 0);
    let count = -1;
    act(() => { count = store().claimRemainingArea(a.id, orig.id); });
    expect(count).toBe(1);
    const regions = store().atlases[0].regions;
    const kept = regions.find((r) => r.id === orig.id)!;
    expect(kept.points).toEqual(frame);
    expect(kept.color).toBe("#3498db");
    const claimed = regions.filter((r) => r.color === "#2ecc71");
    expect(claimed).toHaveLength(1);
    const afterUnion = regions.reduce((acc, r) => acc + areaOf(r.points), 0);
    expect(afterUnion).toBeGreaterThan(beforeUnion);
    expect(afterUnion - beforeUnion).toBeCloseTo(1 - areaOf(rightHalf), 2);
  });
});

describe("fit region into gap (case 9)", () => {
  it("fits a drawn region into the uncovered gap; fully covered -> null without state change", () => {
    const a = addAtlas();
    addRegionDirect(a.id, leftHalf);
    let fitted: Region | null = null;
    act(() => { fitted = store().fitRegionIntoGap(a.id, rightHalf); });
    expect(fitted).not.toBeNull();
    expect(store().atlases[0].regions).toHaveLength(2);
    expect(fitted!.color).toBe("#3498db");
    expect(areaOf(fitted!.points)).toBeCloseTo(0.5, 2);
    const cover = addAtlas("Coberta");
    addRegionDirect(cover.id, frame);
    const before = store().atlases.find((x) => x.id === cover.id)!.regions.length;
    const beforeFlags = selectHistoryFlags(cover.id)(store());
    let none: Region | null = null;
    act(() => { none = store().fitRegionIntoGap(cover.id, quadrant); });
    expect(none).toBeNull();
    expect(store().atlases.find((x) => x.id === cover.id)!.regions).toHaveLength(before);
    expect(selectHistoryFlags(cover.id)(store())).toEqual(beforeFlags);
  });
});

describe("export (case 10)", () => {
  it("exportData validates through parseExport after a full op chain", () => {
    const a = addAtlas();
    addRegionDirect(a.id, frame);
    act(() => { store().addPin(a.id, { x: 0.5, y: 0.5 }); });
    act(() => { store().putMapImage(a.id, "data:image/png;base64,MAP"); });
    act(() => { store().claimRemainingArea(a.id, store().atlases[0].regions[0].id); });
    act(() => { store().fitRegionIntoGap(a.id, quadrant); });
    let json = "";
    act(() => { json = store().exportData(); });
    let parsed!: ReturnType<typeof parseExport>;
    act(() => { parsed = parseExport(json); });
    expect(validateProjectData(parsed)).toBe(true);
    expect(parsed.atlases[0].regions.length).toBeGreaterThanOrEqual(2);
  });
});

describe("persistence boundary", () => {
  it("histories are excluded from the persisted document", () => {
    const a = addAtlas();
    addRegionDirect(a.id, frame);
    expect(store().histories[a.id].undo.length).toBeGreaterThan(0);
    flushPendingPersist();
    const raw = JSON.parse(localStorage.getItem(STORE_KEY)!) as { state: Record<string, unknown> };
    expect(raw.state.histories).toBeUndefined();
  });
});

describe("review fixes (I1/I2)", () => {
  it("updateRegion deep-clones patch points: caller mutation leaves live state and history unchanged", () => {
    const a = addAtlas();
    const r = addRegionDirect(a.id, frame);
    const patchPoints = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 }];
    act(() => { store().updateRegion(r.id, { points: patchPoints }); });
    expect(store().atlases[0].regions.find((x) => x.id === r.id)!.points).toEqual(patchPoints);
    patchPoints[0].x = 99;
    patchPoints[1].y = 0.99;
    const live = store().atlases[0].regions.find((x) => x.id === r.id)!;
    expect(live.points).toEqual([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 }]);
    const atlasHist = store().histories[a.id] as AtlasHistory;
    const snap = atlasHist.undo.at(-1)!.regions.find((x) => x.id === r.id)!;
    expect(snap.points[0].x).toBe(0);
    expect(snap.points[1].y).toBe(0);
    act(() => { store().pushHistory(a.id); });
    const snap2 = atlasHist.undo.at(-1)!.regions.find((x) => x.id === r.id)!;
    expect(snap2.points[0].x).toBe(0);
  });
  it("deleteAtlas drops the atlas history entry", () => {
    const a = addAtlas();
    addRegionDirect(a.id, frame);
    expect(store().histories[a.id].undo.length).toBeGreaterThan(0);
    act(() => { store().deleteAtlas(a.id); });
    expect(store().histories[a.id]).toBeUndefined();
  });
});

describe("fix wave: clip failure guard (F5)", () => {
  it("fitRegionIntoGap → clip throw toasts and returns null with state untouched", () => {
    const a = addAtlas();
    addRegionDirect(a.id, frame);
    const flagsBefore = selectHistoryFlags(a.id)(store());
    clipState.fail = true;
    let fitted: Region | null = null;
    act(() => { fitted = store().fitRegionIntoGap(a.id, quadrant); });
    clipState.fail = false;
    expect(fitted).toBeNull();
    expect(store().atlases[0].regions).toHaveLength(1);
    expect(selectHistoryFlags(a.id)(store())).toEqual(flagsBefore);
    expect(store().toasts.some((t) => t.kind === "error" && t.message === "Couldn't compute the cuts.")).toBe(true);
  });
  it("claimRemainingArea → clip throw toasts and returns 0 with state untouched", () => {
    const a = addAtlas();
    const orig = addRegionDirect(a.id, frame);
    addRegionDirect(a.id, rightHalf);
    const flagsBefore = selectHistoryFlags(a.id)(store());
    clipState.fail = true;
    let count = -1;
    act(() => { count = store().claimRemainingArea(a.id, orig.id); });
    clipState.fail = false;
    expect(count).toBe(0);
    expect(store().atlases[0].regions).toHaveLength(2);
    expect(selectHistoryFlags(a.id)(store())).toEqual(flagsBefore);
    expect(store().toasts.some((t) => t.kind === "error" && t.message === "Couldn't compute the cuts.")).toBe(true);
  });
});

describe("fix wave: lastColor default (F6)", () => {
  it("addRegion defaults to the last picked color; no pick yet → #3498db fallback", () => {
    const a = addAtlas();
    expect(getLastRegionColor()).toBeNull();
    let plain!: Region;
    act(() => { plain = store().addRegion(a.id, { points: leftHalf }) as Region; });
    expect(plain.color).toBe("#3498db");
    // A panel pick (ColorSwatches → pushRecentColor) sets the default:
    act(() => { pushRecentColor("#c9a227"); });
    expect(getLastRegionColor()).toBe("#c9a227");
    let next!: Region | null;
    act(() => { next = store().addRegion(a.id, { points: rightHalf }) as Region | null; });
    expect(next!.color).toBe("#c9a227");
    // Explicit input color still wins.
    let forced!: Region;
    act(() => { forced = store().addRegion(a.id, { points: quadrant, color: "#e74c3c" }) as Region; });
    expect(forced.color).toBe("#e74c3c");
    expect(getLastRegionColor()).toBe("#c9a227");
    resetRecentColors();
    expect(getLastRegionColor()).toBeNull();
  });
});
