import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ProjectData, Project, Atlas, Region, Pin, PinType, WorldEntry, EntryCategory, Manuscript, Chapter,
  Bloodline, BloodlinePerson, BloodlineHouse,
  FactionWeb, Faction, FactionConnection, ConnectionType,
  CustomCalendar, CalendarEvent,
} from "../domain/types";
import { newId } from "../domain/id";
import type { Pt } from "../domain/geometry";
import { isMeaningful } from "../domain/geometry";
import { emptyProjectData, serialize, parseExport } from "./schema";
import { templateSections } from "../features/entries/categories";
import { seedDemoProject } from "./seed";
import { claimRest, fitGap } from "./clip";
import { getLastRegionColor } from "../features/atlas/panels/recentColors";
import { STORE_KEY, localStoragePersistence, wipeStore, storageHealth, PersistedState } from "./storage";

export type ToastKind = "info" | "error" | "success";
export interface Toast { id: string; kind: ToastKind; message: string; }

export type ImageKind = "cover" | "entry" | "map" | "person";

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

export interface BloodlineSnapshot {
  persons: BloodlinePerson[];
  houses: BloodlineHouse[];
}

export interface BloodlineHistory {
  undo: BloodlineSnapshot[];
  redo: BloodlineSnapshot[];
}

export interface FactionWebSnapshot { factions: Faction[]; connections: FactionConnection[] }
export interface FactionWebHistory { undo: FactionWebSnapshot[]; redo: FactionWebSnapshot[] }
export interface CalendarSnapshot { months: CustomCalendar["months"]; weekdays: string[]; weekendDays: number[]; era?: string; startingWeekday: number; events: Record<string, CalendarEvent[]> }
export interface CalendarHistory { undo: CalendarSnapshot[]; redo: CalendarSnapshot[] }
export type AnyHistory = AtlasHistory | BloodlineHistory | FactionWebHistory | CalendarHistory;

const clonePoints = (points: Pt[]): Pt[] => points.map((p) => ({ ...p }));
const touchProject = (projects: readonly Project[], id: string): Project[] =>
  projects.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p));
/** max(orders)+1; 0 when the book is empty. */
const nextChapterOrder = (chapters: readonly Chapter[]): number =>
  chapters.length === 0
    ? 0
    : chapters.reduce((max, c) => (c.order > max ? c.order : max), 0) + 1;
/** Spec §7: polygon-clipping failure surfaces once, state untouched. */
const CLIP_FAILURE_TOAST = "Não consegui calcular os encaixes.";
const cloneSnapshot = (a: Atlas): AtlasSnapshot => ({
  regions: a.regions.map((r) => ({ ...r, points: clonePoints(r.points) })),
  pins: a.pins.map((p) => ({ ...p })),
});

/** `bl_<id>` keys keep bloodline history buckets in the same ephemeral `histories` record. */
const blKey = (bloodlineId: string): string => `bl_${bloodlineId}`;
const fwKey = (webId: string): string => `fw_${webId}`;
const clKey = (calendarId: string): string => `cl_${calendarId}`;

const clonePerson = (p: BloodlinePerson): BloodlinePerson => ({
  ...p,
  additionalTitles: p.additionalTitles.map((t) => ({ ...t })),
  tenures: p.tenures.map((t) => ({ ...t })),
});

const cloneCLSnapshot = (c: CustomCalendar): CalendarSnapshot => ({
  months: c.months.map((m) => ({ ...m })),
  weekdays: [...c.weekdays],
  weekendDays: [...c.weekendDays],
  era: c.era,
  startingWeekday: c.startingWeekday,
  events: Object.fromEntries(Object.entries(c.events).map(([k, v]) => [k, v.map((e) => ({ ...e }))])),
});

const cloneFWSnapshot = (w: FactionWeb): FactionWebSnapshot => ({
  factions: w.factions.map((f) => ({ ...f })),
  connections: w.connections.map((c) => ({ ...c })),
});

const cloneBLSnapshot = (b: Bloodline): BloodlineSnapshot => ({
  persons: b.persons.map(clonePerson),
  houses: b.houses.map((h) => ({ ...h })),
});

/** Portrait keys live in the shared images map; a key is released only when nothing references it. */
const imageReferenced = (
  d: Pick<ProjectData, "projects" | "entries" | "atlases"> & { bloodlines: Bloodline[] },
  key: string,
): boolean =>
  d.projects.some((p) => p.coverImageKey === key)
  || d.entries.some((e) => e.imageKey === key)
  || d.atlases.some((a) => a.mapImageKey === key)
  || d.bloodlines.some((b) => b.persons.some((p) => p.portraitKey === key));

/** Bloodlines are OPTIONAL in the schema but the store state always carries the array. */
interface ScriptoriumState extends ProjectData {
  bloodlines: Bloodline[];
  toasts: Toast[];
  seedFlag: boolean;
  histories: Record<string, AnyHistory>;

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

  addManuscript(projectId: string, title?: string): Manuscript;
  renameManuscript(id: string, title: string): void;
  setManuscriptAuthor(id: string, author: string): void;
  deleteManuscript(id: string): void;
  addChapter(manuscriptId: string, heading?: string): Chapter | null;
  updateChapter(chapterId: string, patch: Partial<Omit<Chapter, "id">>): void;
  deleteChapter(chapterId: string): void;
  moveChapter(chapterId: string, dir: -1 | 1): void;

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

  addBloodline(projectId: string, name?: string): Bloodline;
  renameBloodline(id: string, name: string): void;
  deleteBloodline(id: string): void;
  addPerson(bloodlineId: string, init?: { x?: number; y?: number; name?: string; portraitKey?: string }): BloodlinePerson | null;
  updatePerson(id: string, patch: Partial<Omit<BloodlinePerson, "id">>): void;
  movePerson(id: string, x: number, y: number): void;
  deletePerson(id: string): void;
  addHouse(bloodlineId: string, init?: { x?: number; y?: number; name?: string; subtitle?: string; isMainBranch?: boolean; isMonarch?: boolean }): BloodlineHouse | null;
  updateHouse(id: string, patch: Partial<Omit<BloodlineHouse, "id">>): void;
  moveHouse(id: string, x: number, y: number): void;
  deleteHouse(id: string): void;
  setNotes(bloodlineId: string, notes: string): void;
  pushBLHistory(bloodlineId: string): void;
  undoBL(bloodlineId: string): void;
  redoBL(bloodlineId: string): void;

  addFactionWeb(projectId: string, name?: string): FactionWeb;
  renameFactionWeb(id: string, name: string): void;
  deleteFactionWeb(id: string): void;
  addFaction(webId: string, init?: { x?: number; y?: number; name?: string; color?: string }): Faction | null;
  updateFaction(id: string, patch: Partial<Omit<Faction, "id">>): void;
  moveFaction(id: string, x: number, y: number): void;
  deleteFaction(id: string): void;
  addConnection(webId: string, fromId: string, toId: string): FactionConnection | null;
  setConnectionType(id: string, type: ConnectionType): void;
  removeConnection(id: string): void;
  setWebNotes(webId: string, notes: string): void;
  pushFWHistory(webId: string): void;
  undoFW(webId: string): void;
  redoFW(webId: string): void;

  addCalendar(projectId: string, name?: string): CustomCalendar;
  renameCalendar(id: string, name: string): void;
  deleteCalendar(id: string): void;
  setEra(id: string, era: string | undefined): void;
  setStartingWeekday(id: string, weekday: number): void;
  setMonth(id: string, index: number, patch: { name?: string; days?: number }): void;
  addCalendarEvent(id: string, dayKey: string, ev: { text: string; category: string; color?: string }): CalendarEvent | null;
  updateCalendarEvent(id: string, dayKey: string, eventId: string, patch: { text?: string; category?: string; color?: string }): void;
  removeCalendarEvent(id: string, dayKey: string, eventId: string): void;
  setCalendarNotes(id: string, notes: string): void;
  pushCLHistory(id: string): void;
  undoCL(id: string): void;
  redoCL(id: string): void;
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
        for (const b of s.bloodlines) {
          if (b.projectId !== id) continue;
          for (const p of b.persons) {
            if (p.portraitKey) imageKeys.add(p.portraitKey);
          }
        }
        const keptBloodlines = s.bloodlines.filter((b) => b.projectId !== id);
        const images = { ...s.images };
        for (const key of imageKeys) {
          if (!imageReferenced({ projects: keptProjects, entries: keptEntries, atlases: s.atlases.filter((a) => a.projectId !== id), bloodlines: keptBloodlines }, key)) {
            delete images[key];
          }
        }
        const keptIds = new Set(s.atlases.filter((a) => a.projectId !== id).map((a) => a.id));
        const keptBLIds = new Set(keptBloodlines.map((b) => b.id));
        const histories: Record<string, AnyHistory> = {};
        for (const [key, value] of Object.entries(s.histories)) {
          const isAtlas = keptIds.has(key);
          const isBloodlineKept = key.startsWith("bl_") && keptBLIds.has(key.slice(3));
          if (isAtlas || isBloodlineKept) histories[key] = value;
        }
        set({
          projects: keptProjects,
          entries: keptEntries,
          atlases: s.atlases.filter((a) => a.projectId !== id),
          manuscripts: s.manuscripts.filter((m) => m.projectId !== id),
          bloodlines: keptBloodlines,
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
        const s = get();
        return serialize({
          projects: s.projects,
          entries: s.entries,
          atlases: s.atlases,
          manuscripts: s.manuscripts,
          images: s.images,
          bloodlines: s.bloodlines,
          factionWebs: s.factionWebs,
          calendars: s.calendars,
        });
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
          sections: templateSections(category),
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
        if (from === to) return;
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

      addManuscript(projectId, title = "Livro sem título") {
        const manuscript: Manuscript = {
          id: newId("man"),
          projectId,
          title,
          author: "",
          chapters: [],
        };
        set((s) => ({
          manuscripts: [...s.manuscripts, manuscript],
          projects: touchProject(s.projects, projectId),
        }));
        return manuscript;
      },

      renameManuscript(id, title) {
        const s = get();
        const m = s.manuscripts.find((x) => x.id === id);
        if (!m) return;
        set((st) => ({
          manuscripts: st.manuscripts.map((x) => (x.id === id ? { ...x, title } : x)),
          projects: touchProject(st.projects, m.projectId),
        }));
      },

      setManuscriptAuthor(id, author) {
        const s = get();
        const m = s.manuscripts.find((x) => x.id === id);
        if (!m) return;
        set((st) => ({
          manuscripts: st.manuscripts.map((x) => (x.id === id ? { ...x, author } : x)),
          projects: touchProject(st.projects, m.projectId),
        }));
      },

      deleteManuscript(id) {
        const s = get();
        const m = s.manuscripts.find((x) => x.id === id);
        if (!m) return;
        // Chapters hold no images — nothing to release.
        set((st) => ({
          manuscripts: st.manuscripts.filter((x) => x.id !== id),
          projects: touchProject(st.projects, m.projectId),
        }));
      },

      addChapter(manuscriptId, heading = "Capítulo sem título") {
        const m = get().manuscripts.find((x) => x.id === manuscriptId);
        if (!m) return null;
        const chapter: Chapter = {
          id: newId("ch"),
          heading,
          content: "",
          order: nextChapterOrder(m.chapters),
        };
        set((s) => ({
          manuscripts: s.manuscripts.map((x) =>
            x.id === manuscriptId ? { ...x, chapters: [...x.chapters, chapter] } : x),
          projects: touchProject(s.projects, m.projectId),
        }));
        return chapter;
      },

      updateChapter(chapterId, patch) {
        const m = get().manuscripts.find((x) => x.chapters.some((c) => c.id === chapterId));
        if (!m) return;
        const safe: Partial<Omit<Chapter, "id">> = { ...patch };
        set((s) => ({
          manuscripts: s.manuscripts.map((x) => (x.id !== m.id ? x : {
            ...x,
            chapters: x.chapters.map((c) =>
              c.id === chapterId ? { ...c, ...safe, id: c.id } : c),
          })),
          projects: touchProject(s.projects, m.projectId),
        }));
      },

      deleteChapter(chapterId) {
        const m = get().manuscripts.find((x) => x.chapters.some((c) => c.id === chapterId));
        if (!m) return;
        set((s) => ({
          manuscripts: s.manuscripts.map((x) => (x.id !== m.id ? x : {
            ...x,
            chapters: x.chapters.filter((c) => c.id !== chapterId),
          })),
          projects: touchProject(s.projects, m.projectId),
        }));
      },

      /** Swaps the chapter's order with its nearest neighbor by sorted order;
       *  gaps are tolerated (no renumbering) — spec §7 ruling. */
      moveChapter(chapterId, dir) {
        const m = get().manuscripts.find((x) => x.chapters.some((c) => c.id === chapterId));
        if (!m) return;
        const sorted = [...m.chapters].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex((c) => c.id === chapterId);
        const neighbor = sorted[idx + dir];
        if (!neighbor) return;
        const orderA = sorted[idx].order;
        set((s) => ({
          manuscripts: s.manuscripts.map((x) => (x.id !== m.id ? x : {
            ...x,
            chapters: x.chapters.map((c) => {
              if (c.id === chapterId) return { ...c, order: neighbor.order };
              if (c.id === neighbor.id) return { ...c, order: orderA };
              return c;
            }),
          })),
          projects: touchProject(s.projects, m.projectId),
        }));
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
          const h = st.histories[atlasId] as AtlasHistory | undefined;
          const undo: AtlasSnapshot[] = [...(h?.undo ?? []), cloneSnapshot(atlas)];
          if (undo.length > HISTORY_CAP) undo.shift();
          const entry: AtlasHistory = { undo, redo: [] };
          const histories: Record<string, AnyHistory> = { ...st.histories, [atlasId]: entry };
          return { histories };
        });
      },

      undo(atlasId) {
        set((st) => {
          const h = st.histories[atlasId] as AtlasHistory | undefined;
          const atlas = st.atlases.find((a) => a.id === atlasId);
          if (!h || h.undo.length === 0 || !atlas) return {};
          const snap = h.undo[h.undo.length - 1];
          const entry: AtlasHistory = {
            undo: h.undo.slice(0, -1),
            redo: [...h.redo, cloneSnapshot(atlas)],
          };
          const histories: Record<string, AnyHistory> = { ...st.histories, [atlasId]: entry };
          return {
            histories,
            atlases: st.atlases.map((a) =>
              a.id === atlasId
                ? { ...a, regions: snap.regions.map((r) => ({ ...r, points: clonePoints(r.points) })), pins: snap.pins.map((p) => ({ ...p })) }
                : a),
          };
        });
      },

      redo(atlasId) {
        set((st) => {
          const h = st.histories[atlasId] as AtlasHistory | undefined;
          const atlas = st.atlases.find((a) => a.id === atlasId);
          if (!h || h.redo.length === 0 || !atlas) return {};
          const snap = h.redo[h.redo.length - 1];
          const entry: AtlasHistory = {
            undo: [...h.undo, cloneSnapshot(atlas)],
            redo: h.redo.slice(0, -1),
          };
          const histories: Record<string, AnyHistory> = { ...st.histories, [atlasId]: entry };
          return {
            histories,
            atlases: st.atlases.map((a) =>
              a.id === atlasId
                ? { ...a, regions: snap.regions.map((r) => ({ ...r, points: clonePoints(r.points) })), pins: snap.pins.map((p) => ({ ...p })) }
                : a),
          };
        });
      },

      addBloodline(projectId, name = "Linhagem sem título") {
        const bloodline: Bloodline = {
          id: newId("bl"),
          projectId,
          name,
          persons: [],
          houses: [],
          notes: "",
        };
        set((s) => ({
          bloodlines: [...s.bloodlines, bloodline],
          projects: touchProject(s.projects, projectId),
        }));
        return bloodline;
      },

      renameBloodline(id, name) {
        const s = get();
        const bloodline = s.bloodlines.find((b) => b.id === id);
        if (!bloodline) return;
        set((st) => ({
          bloodlines: st.bloodlines.map((b) => (b.id === id ? { ...b, name } : b)),
          projects: touchProject(st.projects, bloodline.projectId),
        }));
      },

      deleteBloodline(id) {
        const s = get();
        const bloodline = s.bloodlines.find((b) => b.id === id);
        if (!bloodline) return;
        const kept = s.bloodlines.filter((b) => b.id !== id);
        if (kept.length === s.bloodlines.length) return;
        const images = { ...s.images };
        for (const p of bloodline.persons) {
          if (p.portraitKey
            && !imageReferenced({ projects: s.projects, entries: s.entries, atlases: s.atlases, bloodlines: kept }, p.portraitKey)) {
            delete images[p.portraitKey];
          }
        }
        const histories = { ...s.histories };
        delete histories[blKey(id)];
        set({
          bloodlines: kept,
          images,
          histories,
          projects: touchProject(s.projects, bloodline.projectId),
        });
      },

      addPerson(bloodlineId, init) {
        const bloodline = get().bloodlines.find((b) => b.id === bloodlineId);
        if (!bloodline) return null;
        get().pushBLHistory(bloodlineId);
        const person: BloodlinePerson = {
          id: newId("per"),
          x: init?.x ?? 4000,
          y: init?.y ?? 4000,
          name: init?.name ?? "Sem nome",
          additionalTitles: [],
          tenures: [],
          showBadge: false,
          badgeText: "",
          isTwin: false,
          ...(init?.portraitKey ? { portraitKey: init.portraitKey } : {}),
        };
        set((s) => ({
          bloodlines: s.bloodlines.map((b) =>
            b.id === bloodlineId ? { ...b, persons: [...b.persons, person] } : b),
          projects: touchProject(s.projects, bloodline.projectId),
        }));
        return person;
      },

      updatePerson(id, patch) {
        const s = get();
        const bloodline = s.bloodlines.find((b) => b.persons.some((p) => p.id === id));
        if (!bloodline) return;
        const safe: Partial<BloodlinePerson> = { ...patch };
        if (patch.additionalTitles) safe.additionalTitles = patch.additionalTitles.map((t) => ({ ...t }));
        if (patch.tenures) safe.tenures = patch.tenures.map((t) => ({ ...t }));
        get().pushBLHistory(bloodline.id);
        set((st) => ({
          bloodlines: st.bloodlines.map((b) => b.id !== bloodline.id ? b : {
            ...b,
            persons: b.persons.map((p) => (p.id === id ? { ...p, ...safe, id: p.id } : p)),
          }),
          projects: touchProject(st.projects, bloodline.projectId),
        }));
      },

      /** Moves a person without pushing history: the UI calls pushBLHistory once
       *  per drag, on pointerdown — PinLayer pattern. */
      movePerson(id, x, y) {
        const bloodline = get().bloodlines.find((b) => b.persons.some((p) => p.id === id));
        if (!bloodline) return;
        set((st) => ({
          bloodlines: st.bloodlines.map((b) => b.id !== bloodline.id ? b : {
            ...b,
            persons: b.persons.map((p) => (p.id === id ? { ...p, x, y } : p)),
          }),
          projects: touchProject(st.projects, bloodline.projectId),
        }));
      },

      deletePerson(id) {
        const s = get();
        const bloodline = s.bloodlines.find((b) => b.persons.some((p) => p.id === id));
        const person = bloodline?.persons.find((p) => p.id === id);
        if (!bloodline || !person) return;
        get().pushBLHistory(bloodline.id);
        const keptPersons = bloodline.persons.filter((p) => p.id !== id);
        const clean = (p: BloodlinePerson): BloodlinePerson => {
          if (p.connectedTo !== id && p.siblingId !== id && p.partnerId !== id) return p;
          const next = { ...p };
          if (next.connectedTo === id) delete next.connectedTo;
          if (next.siblingId === id) delete next.siblingId;
          if (next.partnerId === id) delete next.partnerId;
          return next;
        };
        const afterBloodlines = s.bloodlines.map((b) =>
          b.id !== bloodline.id ? b : { ...b, persons: keptPersons.map(clean) });
        const images = { ...s.images };
        if (person.portraitKey
          && !imageReferenced({ projects: s.projects, entries: s.entries, atlases: s.atlases, bloodlines: afterBloodlines }, person.portraitKey)) {
          delete images[person.portraitKey];
        }
        set((st) => ({
          bloodlines: afterBloodlines,
          images,
          projects: touchProject(st.projects, bloodline.projectId),
        }));
      },

      addHouse(bloodlineId, init) {
        const bloodline = get().bloodlines.find((b) => b.id === bloodlineId);
        if (!bloodline) return null;
        get().pushBLHistory(bloodlineId);
        const house: BloodlineHouse = {
          id: newId("hou"),
          x: init?.x ?? 4000,
          y: init?.y ?? 4000,
          name: init?.name ?? "Casa sem nome",
          isMainBranch: false,
          isMonarch: false,
          ...(init?.subtitle !== undefined ? { subtitle: init.subtitle } : {}),
          ...(init?.isMainBranch !== undefined ? { isMainBranch: init.isMainBranch } : {}),
          ...(init?.isMonarch !== undefined ? { isMonarch: init.isMonarch } : {}),
        };
        set((s) => ({
          bloodlines: s.bloodlines.map((b) =>
            b.id === bloodlineId ? { ...b, houses: [...b.houses, house] } : b),
          projects: touchProject(s.projects, bloodline.projectId),
        }));
        return house;
      },

      updateHouse(id, patch) {
        const s = get();
        const bloodline = s.bloodlines.find((b) => b.houses.some((h) => h.id === id));
        if (!bloodline) return;
        get().pushBLHistory(bloodline.id);
        set((st) => ({
          bloodlines: st.bloodlines.map((b) => b.id !== bloodline.id ? b : {
            ...b,
            houses: b.houses.map((h) => (h.id === id ? { ...h, ...patch, id: h.id } : h)),
          }),
          projects: touchProject(st.projects, bloodline.projectId),
        }));
      },

      /** Same contract as movePerson: no history push — the UI pushes once per drag. */
      moveHouse(id, x, y) {
        const bloodline = get().bloodlines.find((b) => b.houses.some((h) => h.id === id));
        if (!bloodline) return;
        set((st) => ({
          bloodlines: st.bloodlines.map((b) => b.id !== bloodline.id ? b : {
            ...b,
            houses: b.houses.map((h) => (h.id === id ? { ...h, x, y } : h)),
          }),
          projects: touchProject(st.projects, bloodline.projectId),
        }));
      },

      deleteHouse(id) {
        const s = get();
        const bloodline = s.bloodlines.find((b) => b.houses.some((h) => h.id === id));
        if (!bloodline) return;
        get().pushBLHistory(bloodline.id);
        set((st) => ({
          bloodlines: st.bloodlines.map((b) => b.id !== bloodline.id ? b : {
            ...b,
            houses: b.houses.filter((h) => h.id !== id),
          }),
          projects: touchProject(st.projects, bloodline.projectId),
        }));
      },

      /** Notes live outside the { persons, houses } snapshots, so no history push. */
      setNotes(bloodlineId, notes) {
        const s = get();
        const bloodline = s.bloodlines.find((b) => b.id === bloodlineId);
        if (!bloodline) return;
        set((st) => ({
          bloodlines: st.bloodlines.map((b) => (b.id === bloodlineId ? { ...b, notes } : b)),
          projects: touchProject(st.projects, bloodline.projectId),
        }));
      },

      addFactionWeb(projectId, name = "Frações sem título") {
        const web: FactionWeb = {
          id: newId("fw"),
          projectId,
          name,
          factions: [],
          connections: [],
          notes: "",
        };
        set((s) => ({
          factionWebs: [...(s.factionWebs ?? []), web],
          projects: touchProject(s.projects, projectId),
        }));
        return web;
      },

      renameFactionWeb(id, name) {
        const web = (get().factionWebs ?? []).find((w) => w.id === id);
        if (!web) return;
        set((st) => ({
          factionWebs: (st.factionWebs ?? []).map((w) => (w.id === id ? { ...w, name } : w)),
          projects: touchProject(st.projects, web.projectId),
        }));
      },

      deleteFactionWeb(id) {
        const s = get();
        const web = (s.factionWebs ?? []).find((w) => w.id === id);
        if (!web) return;
        const kept = (s.factionWebs ?? []).filter((w) => w.id !== id);
        if (kept.length === (s.factionWebs ?? []).length) return;
        const histories = { ...s.histories };
        delete histories[fwKey(id)];
        set({
          factionWebs: kept,
          histories,
          projects: touchProject(s.projects, web.projectId),
        });
      },

      addFaction(webId, init) {
        const web = (get().factionWebs ?? []).find((w) => w.id === webId);
        if (!web) return null;
        get().pushFWHistory(webId);
        const faction: Faction = {
          id: newId("fac"),
          x: init?.x ?? 4000,
          y: init?.y ?? 4000,
          name: init?.name ?? "Fração sem nome",
          color: init?.color ?? "#7a7a99",
        };
        set((s) => ({
          factionWebs: (s.factionWebs ?? []).map((w) =>
            w.id === webId ? { ...w, factions: [...w.factions, faction] } : w),
          projects: touchProject(s.projects, web.projectId),
        }));
        return faction;
      },

      updateFaction(id, patch) {
        const s = get();
        const web = (s.factionWebs ?? []).find((w) => w.factions.some((f) => f.id === id));
        if (!web) return;
        get().pushFWHistory(web.id);
        set((st) => ({
          factionWebs: (st.factionWebs ?? []).map((w) => w.id !== web.id ? w : {
            ...w,
            factions: w.factions.map((f) => (f.id === id ? { ...f, ...patch, id: f.id } : f)),
          }),
          projects: touchProject(st.projects, web.projectId),
        }));
      },

      /** No history push — the UI pushes once per drag (PinLayer pattern). */
      moveFaction(id, x, y) {
        const s = get();
        const web = (s.factionWebs ?? []).find((w) => w.factions.some((f) => f.id === id));
        if (!web) return;
        set((st) => ({
          factionWebs: (st.factionWebs ?? []).map((w) => w.id !== web.id ? w : {
            ...w,
            factions: w.factions.map((f) => (f.id === id ? { ...f, x, y } : f)),
          }),
          projects: touchProject(st.projects, web.projectId),
        }));
      },

      deleteFaction(id) {
        const s = get();
        const web = (s.factionWebs ?? []).find((w) => w.factions.some((f) => f.id === id));
        if (!web) return;
        get().pushFWHistory(web.id);
        const keptFactions = web.factions.filter((f) => f.id !== id);
        const keptConnections = web.connections.filter((c) => c.fromId !== id && c.toId !== id);
        if (keptConnections.length !== web.connections.length) {
          // incident connection removal is part of this undo step
        }
        set((st) => ({
          factionWebs: (st.factionWebs ?? []).map((w) => w.id !== web.id ? w : {
            ...w,
            factions: keptFactions,
            connections: keptConnections,
          }),
          projects: touchProject(st.projects, web.projectId),
        }));
      },

      addConnection(webId, fromId, toId) {
        const web = (get().factionWebs ?? []).find((w) => w.id === webId);
        if (!web) return null;
        if (fromId === toId) return null;
        if (web.factions.some((f) => f.id === fromId) === false) return null;
        if (web.factions.some((f) => f.id === toId) === false) return null;
        const dup = web.connections.some(
          (c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId),
        );
        if (dup) return null;
        get().pushFWHistory(webId);
        const conn: FactionConnection = { id: newId("conn"), fromId, toId, type: "neutral" };
        set((s) => ({
          factionWebs: (s.factionWebs ?? []).map((w) =>
            w.id === webId ? { ...w, connections: [...w.connections, conn] } : w),
          projects: touchProject(s.projects, web.projectId),
        }));
        return conn;
      },

      setConnectionType(id, type) {
        const s = get();
        const web = (s.factionWebs ?? []).find((w) => w.connections.some((c) => c.id === id));
        if (!web) return;
        get().pushFWHistory(web.id);
        set((st) => ({
          factionWebs: (st.factionWebs ?? []).map((w) => w.id !== web.id ? w : {
            ...w,
            connections: w.connections.map((c) => (c.id === id ? { ...c, type } : c)),
          }),
          projects: touchProject(st.projects, web.projectId),
        }));
      },

      removeConnection(id) {
        const s = get();
        const web = (s.factionWebs ?? []).find((w) => w.connections.some((c) => c.id === id));
        if (!web) return;
        get().pushFWHistory(web.id);
        set((st) => ({
          factionWebs: (st.factionWebs ?? []).map((w) => w.id !== web.id ? w : {
            ...w,
            connections: w.connections.filter((c) => c.id !== id),
          }),
          projects: touchProject(st.projects, web.projectId),
        }));
      },

      setWebNotes(webId, notes) {
        const web = (get().factionWebs ?? []).find((w) => w.id === webId);
        if (!web) return;
        set((st) => ({
          factionWebs: (st.factionWebs ?? []).map((w) => (w.id === webId ? { ...w, notes } : w)),
          projects: touchProject(st.projects, web.projectId),
        }));
      },

      pushFWHistory(webId) {
        set((st) => {
          const web = (st.factionWebs ?? []).find((w) => w.id === webId);
          if (!web) return {};
          const key = fwKey(webId);
          const h = (st.histories[key] as FactionWebHistory | undefined) ?? { undo: [], redo: [] };
          const undo = [...h.undo, cloneFWSnapshot(web)];
          if (undo.length > HISTORY_CAP) undo.shift();
          const entry: FactionWebHistory = { undo, redo: [] };
          return { histories: { ...st.histories, [key]: entry } };
        });
      },

      undoFW(webId) {
        set((st) => {
          const key = fwKey(webId);
          const h = st.histories[key] as FactionWebHistory | undefined;
          const web = (st.factionWebs ?? []).find((w) => w.id === webId);
          if (!h || h.undo.length === 0 || !web) return {};
          const snap = h.undo[h.undo.length - 1];
          const entry: FactionWebHistory = {
            undo: h.undo.slice(0, -1),
            redo: [...h.redo, cloneFWSnapshot(web)],
          };
          return {
            histories: { ...st.histories, [key]: entry },
            factionWebs: (st.factionWebs ?? []).map((w) =>
              w.id === webId
                ? { ...w, factions: snap.factions.map((f) => ({ ...f })), connections: snap.connections.map((c) => ({ ...c })) }
                : w),
          };
        });
      },

      redoFW(webId) {
        set((st) => {
          const key = fwKey(webId);
          const h = st.histories[key] as FactionWebHistory | undefined;
          const web = (st.factionWebs ?? []).find((w) => w.id === webId);
          if (!h || h.redo.length === 0 || !web) return {};
          const snap = h.redo[h.redo.length - 1];
          const entry: FactionWebHistory = {
            undo: [...h.undo, cloneFWSnapshot(web)],
            redo: h.redo.slice(0, -1),
          };
          return {
            histories: { ...st.histories, [key]: entry },
            factionWebs: (st.factionWebs ?? []).map((w) =>
              w.id === webId
                ? { ...w, factions: snap.factions.map((f) => ({ ...f })), connections: snap.connections.map((c) => ({ ...c })) }
                : w),
          };
        });
      },

      deleteCalendar(id) {
        const s = get();
        const cal = (s.calendars ?? []).find((c) => c.id === id);
        if (!cal) return;
        const histories = { ...s.histories };
        delete histories[clKey(id)];
        set({
          calendars: (s.calendars ?? []).filter((c) => c.id !== id),
          histories,
          projects: touchProject(s.projects, cal.projectId),
        });
      },

      addCalendar(projectId, name = "Calendário sem título") {
        const calendar: CustomCalendar = {
          id: newId("cal"),
          projectId,
          name,
          months: Array.from({ length: 12 }, (_, i) => ({ name: `Mês ${i + 1}`, days: 30 })),
          weekdays: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
          weekendDays: [0, 6],
          events: {},
          startingWeekday: 0,
          notes: "",
        };
        set((s) => ({
          calendars: [...(s.calendars ?? []), calendar],
          projects: touchProject(s.projects, projectId),
        }));
        return calendar;
      },

      renameCalendar(id, name) {
        const cal = (get().calendars ?? []).find((c) => c.id === id);
        if (!cal) return;
        set((st) => ({
          calendars: (st.calendars ?? []).map((c) => (c.id === id ? { ...c, name } : c)),
          projects: touchProject(st.projects, cal.projectId),
        }));
      },

      setEra(id, era) {
        const cal = (get().calendars ?? []).find((c) => c.id === id);
        if (!cal) return;
        get().pushCLHistory(id);
        set((st) => ({
          calendars: (st.calendars ?? []).map((c) => (c.id === id ? { ...c, era } : c)),
          projects: touchProject(st.projects, cal.projectId),
        }));
      },

      setStartingWeekday(id, weekday) {
        const cal = (get().calendars ?? []).find((c) => c.id === id);
        if (!cal || weekday < 0 || weekday > 6) return;
        get().pushCLHistory(id);
        set((st) => ({
          calendars: (st.calendars ?? []).map((c) => (c.id === id ? { ...c, startingWeekday: weekday } : c)),
          projects: touchProject(st.projects, cal.projectId),
        }));
      },

      setMonth(id, index, patch) {
        const cal = (get().calendars ?? []).find((c) => c.id === id);
        if (!cal || !cal.months[index]) return;
        const next = { ...cal.months[index] };
        if (patch.name !== undefined) next.name = patch.name.trim() || next.name;
        if (patch.days !== undefined && Number.isFinite(patch.days) && patch.days >= 1) next.days = Math.round(patch.days);
        get().pushCLHistory(id);
        set((st) => ({
          calendars: (st.calendars ?? []).map((c) => (c.id === id
            ? { ...c, months: c.months.map((m, j) => (j === index ? next : m)) }
            : c)),
          projects: touchProject(st.projects, cal.projectId),
        }));
      },

      addCalendarEvent(id, dayKey, ev) {
        const cal = (get().calendars ?? []).find((c) => c.id === id);
        if (!cal || !ev.text.trim()) return null;
        get().pushCLHistory(id);
        const event: CalendarEvent = { id: newId("clv"), text: ev.text.trim(), category: ev.category, color: ev.color };
        set((st) => ({
          calendars: (st.calendars ?? []).map((c) => (c.id === id
            ? { ...c, events: { ...c.events, [dayKey]: [...(c.events[dayKey] ?? []), event] } }
            : c)),
          projects: touchProject(st.projects, cal.projectId),
        }));
        return event;
      },

      updateCalendarEvent(id, dayKey, eventId, patch) {
        const cal = (get().calendars ?? []).find((c) => c.id === id);
        if (!cal || !cal.events[dayKey]?.some((e) => e.id === eventId)) return;
        get().pushCLHistory(id);
        set((st) => ({
          calendars: (st.calendars ?? []).map((c) => (c.id === id
            ? { ...c, events: { ...c.events, [dayKey]: c.events[dayKey].map((e) => (e.id === eventId ? { ...e, ...patch, id: e.id } : e)) } }
            : c)),
          projects: touchProject(st.projects, cal.projectId),
        }));
      },

      removeCalendarEvent(id, dayKey, eventId) {
        const cal = (get().calendars ?? []).find((c) => c.id === id);
        if (!cal || !cal.events[dayKey]?.some((e) => e.id === eventId)) return;
        get().pushCLHistory(id);
        const remaining = cal.events[dayKey].filter((e) => e.id !== eventId);
        set((st) => ({
          calendars: (st.calendars ?? []).map((c) => {
            if (c.id !== id) return c;
            const events = { ...c.events };
            if (remaining.length) events[dayKey] = remaining;
            else delete events[dayKey];
            return { ...c, events };
          }),
          projects: touchProject(st.projects, cal.projectId),
        }));
      },

      setCalendarNotes(id, notes) {
        const cal = (get().calendars ?? []).find((c) => c.id === id);
        if (!cal) return;
        set((st) => ({
          calendars: (st.calendars ?? []).map((c) => (c.id === id ? { ...c, notes } : c)),
          projects: touchProject(st.projects, cal.projectId),
        }));
      },

      pushCLHistory(id) {
        set((st) => {
          const cal = (st.calendars ?? []).find((c) => c.id === id);
          if (!cal) return {};
          const key = clKey(id);
          const h = (st.histories[key] as CalendarHistory | undefined) ?? { undo: [], redo: [] };
          const undo = [...h.undo, cloneCLSnapshot(cal)];
          if (undo.length > HISTORY_CAP) undo.shift();
          const entry: CalendarHistory = { undo, redo: [] };
          return { histories: { ...st.histories, [key]: entry } };
        });
      },

      undoCL(id) {
        set((st) => {
          const key = clKey(id);
          const h = st.histories[key] as CalendarHistory | undefined;
          const cal = (st.calendars ?? []).find((c) => c.id === id);
          if (!h || h.undo.length === 0 || !cal) return {};
          const snap = h.undo[h.undo.length - 1];
          const entry: CalendarHistory = {
            undo: h.undo.slice(0, -1),
            redo: [...h.redo, cloneCLSnapshot(cal)],
          };
          return {
            histories: { ...st.histories, [key]: entry },
            calendars: (st.calendars ?? []).map((c) => (c.id === id
              ? { ...c, months: snap.months.map((m) => ({ ...m })), weekdays: [...snap.weekdays], weekendDays: [...snap.weekendDays], era: snap.era, startingWeekday: snap.startingWeekday, events: snap.events }
              : c)),
          };
        });
      },

      redoCL(id) {
        set((st) => {
          const key = clKey(id);
          const h = st.histories[key] as CalendarHistory | undefined;
          const cal = (st.calendars ?? []).find((c) => c.id === id);
          if (!h || h.redo.length === 0 || !cal) return {};
          const snap = h.redo[h.redo.length - 1];
          const entry: CalendarHistory = {
            undo: [...h.undo, cloneCLSnapshot(cal)],
            redo: h.redo.slice(0, -1),
          };
          return {
            histories: { ...st.histories, [key]: entry },
            calendars: (st.calendars ?? []).map((c) => (c.id === id
              ? { ...c, months: snap.months.map((m) => ({ ...m })), weekdays: [...snap.weekdays], weekendDays: [...snap.weekendDays], era: snap.era, startingWeekday: snap.startingWeekday, events: snap.events }
              : c)),
          };
        });
      },

      pushBLHistory(bloodlineId) {
        set((st) => {
          const bloodline = st.bloodlines.find((b) => b.id === bloodlineId);
          if (!bloodline) return {};
          const key = blKey(bloodlineId);
          const h = (st.histories[key] as BloodlineHistory | undefined) ?? { undo: [], redo: [] };
          const undo = [...h.undo, cloneBLSnapshot(bloodline)];
          if (undo.length > HISTORY_CAP) undo.shift();
          return { histories: { ...st.histories, [key]: { undo, redo: [] } } };
        });
      },

      undoBL(bloodlineId) {
        set((st) => {
          const key = blKey(bloodlineId);
          const h = st.histories[key] as BloodlineHistory | undefined;
          const bloodline = st.bloodlines.find((b) => b.id === bloodlineId);
          if (!h || h.undo.length === 0 || !bloodline) return {};
          const snap = h.undo[h.undo.length - 1];
          return {
            histories: {
              ...st.histories,
              [key]: {
                undo: h.undo.slice(0, -1),
                redo: [...h.redo, cloneBLSnapshot(bloodline)],
              },
            },
            bloodlines: st.bloodlines.map((b) =>
              b.id === bloodlineId
                ? { ...b, persons: snap.persons.map(clonePerson), houses: snap.houses.map((hc) => ({ ...hc })) }
                : b),
          };
        });
      },

      redoBL(bloodlineId) {
        set((st) => {
          const key = blKey(bloodlineId);
          const h = st.histories[key] as BloodlineHistory | undefined;
          const bloodline = st.bloodlines.find((b) => b.id === bloodlineId);
          if (!h || h.redo.length === 0 || !bloodline) return {};
          const snap = h.redo[h.redo.length - 1];
          return {
            histories: {
              ...st.histories,
              [key]: {
                undo: [...h.undo, cloneBLSnapshot(bloodline)],
                redo: h.redo.slice(0, -1),
              },
            },
            bloodlines: st.bloodlines.map((b) =>
              b.id === bloodlineId
                ? { ...b, persons: snap.persons.map(clonePerson), houses: snap.houses.map((hc) => ({ ...hc })) }
                : b),
          };
        });
      },
    }),
    {
      name: STORE_KEY,
      version: 2,
      storage: localStoragePersistence,
      /** v1 persisted docs lack bloodlines; migrate attaches the default empty
       *  array so every loaded state has the field. */
      migrate: (persisted, from) => {
        if (from !== 1) return persisted as PersistedState;
        const p = persisted as Partial<PersistedState>;
        return { ...p, bloodlines: p.bloodlines ?? [] } as PersistedState;
      },
      partialize: ({ histories: _h, ...s }): PersistedState => {
        void _h; // ephemeral histories are never persisted
        return {
          projects: s.projects,
          entries: s.entries,
          atlases: s.atlases,
          manuscripts: s.manuscripts,
          images: s.images,
          bloodlines: s.bloodlines,
          factionWebs: s.factionWebs,
          calendars: s.calendars,
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

export const selectBLHistoryFlags = (bloodlineId: string) => (s: ScriptoriumState): { canUndo: boolean; canRedo: boolean } => {
  const h = s.histories[blKey(bloodlineId)];
  return { canUndo: (h?.undo.length ?? 0) > 0, canRedo: (h?.redo.length ?? 0) > 0 };
};
