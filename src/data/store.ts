import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProjectData, Project, Atlas, Region, Pin, PinType, WorldEntry, EntryCategory } from "../domain/types";
import { newId } from "../domain/id";
import type { Pt } from "../domain/geometry";
import { isMeaningful } from "../domain/geometry";
import { emptyProjectData, serialize, parseExport } from "./schema";
import { seedDemoProject } from "./seed";
import { claimRest, fitGap } from "./clip";
import { getLastRegionColor } from "../features/atlas/panels/recentColors";
import { STORE_KEY, localStoragePersistence, wipeStore, storageHealth, PersistedState } from "./storage";

export type ToastKind = "info" | "error" | "success";
export interface Toast { id: string; kind: ToastKind; message: string; }

export type ImageKind = "cover" | "entry" | "map";

export const CORRUPTION_TOAST = "Dados corrompidos foram preservados em backup; a app abriu vazia.";
export const CORRUPTION_TOAST_KIND: ToastKind = "info";

export const REGION_DEFAULT_COLOR = "#3498db";
export const REGION_DEFAULT_OPACITY = 0.28;
export const CLAIM_COLOR = "#2ecc71";
export const PIN_DEFAULT_COLOR = "#e74c3c";
export const HISTORY_CAP = 50;

export interface AtlasSnapshot {
  regions: Region[];
  pins: Pin[];
}

export interface AtlasHistory {
  undo: AtlasSnapshot[];
  redo: AtlasSnapshot[];
}

const clonePoints = (points: Pt[]): Pt[] => points.map((p) => ({ ...p }));
const touchProject = (projects: readonly Project[], id: string): Project[] =>
  projects.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p));
/** Spec §7: polygon-clipping failure surfaces once, state untouched. */
const CLIP_FAILURE_TOAST = "Não consegui calcular os encaixes.";
const cloneSnapshot = (a: Atlas): AtlasSnapshot => ({
  regions: a.regions.map((r) => ({ ...r, points: clonePoints(r.points) })),
  pins: a.pins.map((p) => ({ ...p })),
});

interface ScriptoriumState extends ProjectData {
  toasts: Toast[];
  seedFlag: boolean;
  histories: Record<string, AtlasHistory>;

  addProject(name: string, description?: string): Project;
  updateProject(id: string, patch: { name?: string; description?: string; coverImageKey?: string }): void;
  deleteProject(id: string): void;
  putImage(dataUrl: string, kind: ImageKind): string;
  removeImage(key: string): void;
  pushToast(kind: ToastKind, message: string): string;
  dismissToast(id: string): void;
  seedDemo(): string | null;
  exportData(): string;
  importData(text: string): { ok: true } | { ok: false; error: string };
  resetAll(): void;

  addEntry(projectId: string, category?: EntryCategory): WorldEntry;
  updateEntry(id: string, patch: Partial<Omit<WorldEntry, "id">>): void;
  deleteEntry(id: string): void;
  linkEntries(from: string, to: string): void;
  unlinkEntries(from: string, to: string): void;
  putEntryImage(entryId: string, dataUrl: string): boolean;

  addAtlas(projectId: string, name: string): Atlas;
  renameAtlas(atlasId: string, name: string): void;
  deleteAtlas(atlasId: string): void;
  putMapImage(atlasId: string, dataUrl: string): boolean;
  setAtlasMapFromEntry(atlasId: string, entryId: string): boolean;
  addRegion(atlasId: string, input: { points: Pt[]; color?: string; fillOpacity?: number; label?: string; entryId?: string }): Region | null;
  updateRegion(regionId: string, patch: Partial<Omit<Region, "id">>): void;
  deleteRegion(regionId: string): void;
  addPin(atlasId: string, input: { x: number; y: number; type?: PinType; color?: string; label?: string; entryId?: string }): Pin | null;
  updatePin(pinId: string, patch: Partial<Omit<Pin, "id">>): void;
  movePin(pinId: string, x: number, y: number): void;
  deletePin(pinId: string): void;
  claimRemainingArea(atlasId: string, regionId: string): number;
  fitRegionIntoGap(atlasId: string, drawn: Pt[], color?: string): Region | null;
  pushHistory(atlasId: string): void;
  undo(atlasId: string): void;
  redo(atlasId: string): void;
}

export const useScriptorium = create<ScriptoriumState>()(
  persist(
    (set, get) => ({
      ...emptyProjectData(),
      toasts: [],
      seedFlag: false,
      histories: {},

      addProject(name, description = "") {
        const project: Project = {
          id: newId("prj"),
          name,
          description,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ projects: [...s.projects, project] }));
        return project;
      },

      updateProject(id, patch) {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p),
        }));
      },

      deleteProject(id) {
        const s = get();
        const keptProjects = s.projects.filter((p) => p.id !== id);
        if (keptProjects.length === s.projects.length) return;
        const imageKeys = new Set<string>();
        for (const e of s.entries) {
          if (e.projectId === id && e.imageKey) imageKeys.add(e.imageKey);
        }
        const keptEntries = s.entries.filter((e) => e.projectId !== id);
        for (const a of s.atlases) {
          if (a.projectId === id && a.mapImageKey) imageKeys.add(a.mapImageKey);
        }
        const project = s.projects.find((p) => p.id === id);
        if (project?.coverImageKey) imageKeys.add(project.coverImageKey);
        const images = { ...s.images };
        imageKeys.forEach((k) => { delete images[k]; });
        const keptIds = new Set(s.atlases.filter((a) => a.projectId !== id).map((a) => a.id));
        const histories: Record<string, AtlasHistory> = {};
        for (const [key, value] of Object.entries(s.histories)) {
          if (keptIds.has(key)) histories[key] = value;
        }
        set({
          projects: keptProjects,
          entries: keptEntries,
          atlases: s.atlases.filter((a) => a.projectId !== id),
          manuscripts: s.manuscripts.filter((m) => m.projectId !== id),
          images,
          histories,
        });
      },

      putImage(dataUrl, kind) {
        const key = `img_${kind}_${newId("")}`;
        set((s) => ({ images: { ...s.images, [key]: dataUrl } }));
        return key;
      },

      removeImage(key) {
        set((s) => {
          const images = { ...s.images };
          delete images[key];
          return { images };
        });
      },

      pushToast(kind, message) {
        const id = newId("toast");
        set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
        return id;
      },

      dismissToast(id) {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      },

      seedDemo() {
        const demo = seedDemoProject();
        set((s) => ({
          projects: [...s.projects, ...demo.projects],
          entries: [...s.entries, ...demo.entries],
          atlases: [...s.atlases, ...demo.atlases],
          manuscripts: [...s.manuscripts, ...demo.manuscripts],
          images: { ...s.images, ...demo.images },
          seedFlag: true,
        }));
        return demo.projects[0].id;
      },

      exportData() {
        const { projects, entries, atlases, manuscripts, images } = get();
        return serialize({ projects, entries, atlases, manuscripts, images });
      },

      importData(text) {
        try {
          const data = parseExport(text);
          set({ ...data, histories: {} });
          return { ok: true as const };
        } catch (e) {
          return { ok: false as const, error: (e as Error).message };
        }
      },

      resetAll() {
        wipeStore();
        set(() => ({ ...emptyProjectData(), toasts: [], seedFlag: false, histories: {} }));
      },

      addAtlas(projectId, name) {
        const atlas: Atlas = {
          id: newId("atl"),
          projectId,
          name,
          regions: [],
          pins: [],
        };
        set((s) => ({ atlases: [...s.atlases, atlas] }));
        return atlas;
      },

      renameAtlas(atlasId, name) {
        set((s) => ({
          atlases: s.atlases.map((a) => (a.id === atlasId ? { ...a, name } : a)),
        }));
      },

      deleteAtlas(atlasId) {
        const s = get();
        const atlas = s.atlases.find((a) => a.id === atlasId);
        if (!atlas) return;
        const kept = s.atlases.filter((a) => a.id !== atlasId);
        if (kept.length === s.atlases.length) return;
        const images = { ...s.images };
        if (atlas.mapImageKey
          && !kept.some((a) => a.mapImageKey === atlas.mapImageKey)) {
          delete images[atlas.mapImageKey];
        }
        const histories = { ...s.histories };
        delete histories[atlasId];
        set({ atlases: kept, images, histories });
      },

      putMapImage(atlasId, dataUrl) {
        const atlas = get().atlases.find((a) => a.id === atlasId);
        if (!atlas) return false;
        const key = `img_map_${newId("")}`;
        set((st) => ({ images: { ...st.images, [key]: dataUrl } }));
        let stored = false;
        try {
          const raw = localStorage.getItem(STORE_KEY);
          if (raw) {
            const doc = JSON.parse(raw) as { state: { images: Record<string, string> } };
            stored = doc.state.images[key] === dataUrl;
          }
        } catch {
          stored = false;
        }
        if (!stored) {
          set((st) => {
            const images = { ...st.images };
            delete images[key];
            return { images };
          });
          return false;
        }
        const prevKey = atlas.mapImageKey;
        set((st) => ({
          atlases: st.atlases.map((a) => (a.id === atlasId ? { ...a, mapImageKey: key } : a)),
        }));
        if (prevKey && prevKey !== key && !get().atlases.some((a) => a.mapImageKey === prevKey)) {
          set((st) => {
            const images = { ...st.images };
            delete images[prevKey];
            return { images };
          });
        }
        return true;
      },

      addEntry(projectId, category = "lore") {
        const entry: WorldEntry = {
          id: newId("ent"),
          projectId,
          title: "Sem título",
          category,
          body: "",
          links: [],
        };
        set((s) => ({
          entries: [...s.entries, entry],
          projects: touchProject(s.projects, projectId),
        }));
        return entry;
      },

      updateEntry(id, patch) {
        const entry = get().entries.find((e) => e.id === id);
        if (!entry) return;
        const safe: Partial<Omit<WorldEntry, "id">> = { ...patch };
        if (patch.links) safe.links = [...patch.links];
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id ? { ...e, ...safe, id: e.id } : e),
          projects: touchProject(s.projects, entry.projectId),
        }));
      },

      deleteEntry(id) {
        const s = get();
        const entry = s.entries.find((e) => e.id === id);
        if (!entry) return;
        const kept = s.entries.filter((e) => e.id !== id);
        const images = { ...s.images };
        if (entry.imageKey && !kept.some((e) => e.imageKey === entry.imageKey)) {
          delete images[entry.imageKey];
        }
        set({
          entries: kept.map((e) =>
            e.links.includes(id) ? { ...e, links: e.links.filter((l) => l !== id) } : e),
          images,
          projects: touchProject(s.projects, entry.projectId),
        });
      },

      linkEntries(from, to) {
        const s = get();
        const origin = s.entries.find((e) => e.id === from);
        if (!origin || !s.entries.some((e) => e.id === to) || origin.links.includes(to)) return;
        set((st) => ({
          entries: st.entries.map((e) =>
            e.id === from ? { ...e, links: [...e.links, to] } : e),
          projects: touchProject(st.projects, origin.projectId),
        }));
      },

      unlinkEntries(from, to) {
        const origin = get().entries.find((e) => e.id === from);
        if (!origin || !origin.links.includes(to)) return;
        set((st) => ({
          entries: st.entries.map((e) =>
            e.id === from ? { ...e, links: e.links.filter((l) => l !== to) } : e),
          projects: touchProject(st.projects, origin.projectId),
        }));
      },

      putEntryImage(entryId, dataUrl) {
        const entry = get().entries.find((e) => e.id === entryId);
        if (!entry) return false;
        const key = `img_entry_${newId("")}`;
        set((st) => ({ images: { ...st.images, [key]: dataUrl } }));
        let stored = false;
        try {
          const raw = localStorage.getItem(STORE_KEY);
          if (raw) {
            const doc = JSON.parse(raw) as { state: { images: Record<string, string> } };
            stored = doc.state.images[key] === dataUrl;
          }
        } catch {
          stored = false;
        }
        if (!stored) {
          set((st) => {
            const images = { ...st.images };
            delete images[key];
            return { images };
          });
          return false;
        }
        const prevKey = entry.imageKey;
        set((st) => ({
          entries: st.entries.map((e) =>
            e.id === entryId ? { ...e, imageKey: key } : e),
          projects: touchProject(st.projects, entry.projectId),
        }));
        if (prevKey && prevKey !== key && !get().entries.some((e) => e.imageKey === prevKey)) {
          set((st) => {
            const images = { ...st.images };
            delete images[prevKey];
            return { images };
          });
        }
        return true;
      },

      setAtlasMapFromEntry(atlasId, entryId) {
        const s = get();
        const entry = s.entries.find((e) => e.id === entryId);
        const src = entry?.imageKey ? s.images[entry.imageKey] : undefined;
        if (!src) return false;
        return s.putMapImage(atlasId, src);
      },

      addRegion(atlasId, input) {
        const atlas = get().atlases.find((a) => a.id === atlasId);
        if (!atlas) return null;
        if (input.points.length < 3 || !isMeaningful(input.points)) return null;
        get().pushHistory(atlasId);
        const region: Region = {
          id: newId("reg"),
          points: clonePoints(input.points),
          color: input.color ?? getLastRegionColor() ?? REGION_DEFAULT_COLOR,
          fillOpacity: input.fillOpacity ?? REGION_DEFAULT_OPACITY,
          label: input.label ?? "",
          entryId: input.entryId,
        };
        set((st) => ({
          atlases: st.atlases.map((a) =>
            a.id === atlasId ? { ...a, regions: [...a.regions, region] } : a),
        }));
        return region;
      },

      updateRegion(regionId, patch) {
        const atlas = get().atlases.find((a) => a.regions.some((r) => r.id === regionId));
        if (!atlas) return;
        if (patch.points
          && (patch.points.length < 3 || !isMeaningful(patch.points))) return;
        get().pushHistory(atlas.id);
        const safe = { ...patch };
        if (patch.points) safe.points = clonePoints(patch.points);
        set((st) => ({
          atlases: st.atlases.map((a) => ({
            ...a,
            regions: a.regions.map((r) =>
              r.id === regionId ? { ...r, ...safe, id: r.id } : r),
          })),
        }));
      },

      deleteRegion(regionId) {
        const atlas = get().atlases.find((a) => a.regions.some((r) => r.id === regionId));
        if (!atlas) return;
        get().pushHistory(atlas.id);
        set((st) => ({
          atlases: st.atlases.map((a) => ({
            ...a,
            regions: a.regions.filter((r) => r.id !== regionId),
          })),
        }));
      },

      addPin(atlasId, input) {
        const atlas = get().atlases.find((a) => a.id === atlasId);
        if (!atlas) return null;
        get().pushHistory(atlasId);
        const pin: Pin = {
          id: newId("pin"),
          x: input.x,
          y: input.y,
          type: input.type ?? "place",
          color: input.color ?? PIN_DEFAULT_COLOR,
          label: input.label ?? "",
          entryId: input.entryId,
        };
        set((st) => ({
          atlases: st.atlases.map((a) =>
            a.id === atlasId ? { ...a, pins: [...a.pins, pin] } : a),
        }));
        return pin;
      },

      updatePin(pinId, patch) {
        const atlas = get().atlases.find((a) => a.pins.some((p) => p.id === pinId));
        if (!atlas) return;
        get().pushHistory(atlas.id);
        set((st) => ({
          atlases: st.atlases.map((a) => ({
            ...a,
            pins: a.pins.map((p) =>
              p.id === pinId ? { ...p, ...patch, id: p.id } : p),
          })),
        }));
      },

      /** Moves the pin without pushing history: the UI calls pushHistory(atlasId)
       *  once per drag, on pointerdown. */
      movePin(pinId, x, y) {
        set((st) => ({
          atlases: st.atlases.map((a) => ({
            ...a,
            pins: a.pins.map((p) => (p.id === pinId ? { ...p, x, y } : p)),
          })),
        }));
      },

      deletePin(pinId) {
        const atlas = get().atlases.find((a) => a.pins.some((p) => p.id === pinId));
        if (!atlas) return;
        get().pushHistory(atlas.id);
        set((st) => ({
          atlases: st.atlases.map((a) => ({
            ...a,
            pins: a.pins.filter((p) => p.id !== pinId),
          })),
        }));
      },

      claimRemainingArea(atlasId, regionId) {
        const atlas = get().atlases.find((a) => a.id === atlasId);
        const region = atlas?.regions.find((r) => r.id === regionId);
        if (!atlas || !region) return 0;
        const others = atlas.regions
          .filter((r) => r.id !== regionId)
          .map((r) => r.points);
        let rest: Pt[][];
        try {
          rest = claimRest(region.points, others);
        } catch {
          get().pushToast("error", CLIP_FAILURE_TOAST);
          return 0;
        }
        if (rest.length === 0) return 0;
        get().pushHistory(atlasId);
        const created: Region[] = rest.map((points) => ({
          id: newId("reg"),
          points,
          color: CLAIM_COLOR,
          fillOpacity: REGION_DEFAULT_OPACITY,
          label: "",
        }));
        set((st) => ({
          atlases: st.atlases.map((a) =>
            a.id === atlasId ? { ...a, regions: [...a.regions, ...created] } : a),
        }));
        return created.length;
      },

      fitRegionIntoGap(atlasId, drawn, color) {
        const atlas = get().atlases.find((a) => a.id === atlasId);
        if (!atlas) return null;
        let fitted: Pt[] | null;
        try {
          fitted = fitGap(drawn, atlas.regions.map((r) => r.points));
        } catch {
          get().pushToast("error", CLIP_FAILURE_TOAST);
          return null;
        }
        if (!fitted) return null;
        return get().addRegion(atlasId, { points: fitted, ...(color !== undefined ? { color } : {}) });
      },

      pushHistory(atlasId) {
        set((st) => {
          const atlas = st.atlases.find((a) => a.id === atlasId);
          if (!atlas) return {};
          const h = st.histories[atlasId] ?? { undo: [], redo: [] };
          const undo = [...h.undo, cloneSnapshot(atlas)];
          if (undo.length > HISTORY_CAP) undo.shift();
          return { histories: { ...st.histories, [atlasId]: { undo, redo: [] } } };
        });
      },

      undo(atlasId) {
        set((st) => {
          const h = st.histories[atlasId];
          const atlas = st.atlases.find((a) => a.id === atlasId);
          if (!h || h.undo.length === 0 || !atlas) return {};
          const snap = h.undo[h.undo.length - 1];
          return {
            histories: {
              ...st.histories,
              [atlasId]: {
                undo: h.undo.slice(0, -1),
                redo: [...h.redo, cloneSnapshot(atlas)],
              },
            },
            atlases: st.atlases.map((a) =>
              a.id === atlasId
                ? { ...a, regions: snap.regions.map((r) => ({ ...r, points: clonePoints(r.points) })), pins: snap.pins.map((p) => ({ ...p })) }
                : a),
          };
        });
      },

      redo(atlasId) {
        set((st) => {
          const h = st.histories[atlasId];
          const atlas = st.atlases.find((a) => a.id === atlasId);
          if (!h || h.redo.length === 0 || !atlas) return {};
          const snap = h.redo[h.redo.length - 1];
          return {
            histories: {
              ...st.histories,
              [atlasId]: {
                undo: [...h.undo, cloneSnapshot(atlas)],
                redo: h.redo.slice(0, -1),
              },
            },
            atlases: st.atlases.map((a) =>
              a.id === atlasId
                ? { ...a, regions: snap.regions.map((r) => ({ ...r, points: clonePoints(r.points) })), pins: snap.pins.map((p) => ({ ...p })) }
                : a),
          };
        });
      },
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: localStoragePersistence,
      partialize: ({ histories: _h, ...s }): PersistedState => {
        void _h; // ephemeral histories are never persisted
        return {
          projects: s.projects,
          entries: s.entries,
          atlases: s.atlases,
          manuscripts: s.manuscripts,
          images: s.images,
          seedFlag: s.seedFlag,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        const recoveringCorruption = !!state && !error
          && state.projects.length === 0
          && state.entries.length === 0
          && state.atlases.length === 0
          && state.manuscripts.length === 0
          && Object.keys(state.images).length === 0
          && storageHealth().corruptBackups > 0;
        if (recoveringCorruption) {
          state.pushToast(CORRUPTION_TOAST_KIND, CORRUPTION_TOAST);
        }
      },
    },
  ),
);

// selectors
export const selectProject = (id: string) => (s: ScriptoriumState): Project | undefined =>
  s.projects.find((p) => p.id === id);

export interface ProjectCounts { entries: number; atlases: number; manuscripts: number; chapters: number }

export const selectCounts = (projectId: string) => (s: ScriptoriumState): ProjectCounts => ({
  entries: s.entries.filter((e) => e.projectId === projectId).length,
  atlases: s.atlases.filter((a) => a.projectId === projectId).length,
  manuscripts: s.manuscripts.filter((m) => m.projectId === projectId).length,
  chapters: s.manuscripts.filter((m) => m.projectId === projectId)
    .reduce((acc, m) => acc + m.chapters.length, 0),
});

export const selectHistoryFlags = (atlasId: string) => (s: ScriptoriumState): { canUndo: boolean; canRedo: boolean } => ({
  canUndo: (s.histories[atlasId]?.undo.length ?? 0) > 0,
  canRedo: (s.histories[atlasId]?.redo.length ?? 0) > 0,
});
