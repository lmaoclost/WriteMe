import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProjectData, Project } from "../domain/types";
import { newId } from "../domain/id";
import { emptyProjectData, serialize, parseExport } from "./schema";
import { STORE_KEY, localStoragePersistence, wipeStore } from "./storage";

export { act } from "react";

export type ToastKind = "info" | "error" | "success";
export interface Toast { id: string; kind: ToastKind; message: string; }

export type ImageKind = "cover" | "entry" | "map";

type PersistedState = ProjectData & { seedFlag: boolean };

interface ScriptoriumState extends ProjectData {
  toasts: Toast[];
  seedFlag: boolean;

  addProject(name: string, description?: string): Project;
  updateProject(id: string, patch: { name?: string; description?: string; coverImageKey?: string }): void;
  deleteProject(id: string): void;
  putImage(dataUrl: string, kind: ImageKind): string;
  removeImage(key: string): void;
  pushToast(kind: ToastKind, message: string): string;
  dismissToast(id: string): void;
  hasSeed(): boolean;
  seedDemo(): string | null;
  exportData(): string;
  importData(text: string): { ok: true } | { ok: false; error: string };
  resetAll(): void;
}

export const useScriptorium = create<ScriptoriumState>()(
  persist(
    (set, get) => ({
      ...emptyProjectData(),
      toasts: [],
      seedFlag: false,

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
        set({
          projects: keptProjects,
          entries: keptEntries,
          atlases: s.atlases.filter((a) => a.projectId !== id),
          manuscripts: s.manuscripts.filter((m) => m.projectId !== id),
          images,
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

      hasSeed() {
        return get().seedFlag;
      },

      seedDemo() {
        return null; // replaced in Task 8
      },

      exportData() {
        const { projects, entries, atlases, manuscripts, images } = get();
        return serialize({ projects, entries, atlases, manuscripts, images });
      },

      importData(text) {
        try {
          const data = parseExport(text);
          set({ ...data });
          return { ok: true as const };
        } catch (e) {
          return { ok: false as const, error: (e as Error).message };
        }
      },

      resetAll() {
        wipeStore();
        set(() => ({ ...emptyProjectData(), toasts: [], seedFlag: false }));
      },
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: localStoragePersistence,
      partialize: (s): PersistedState => ({
        projects: s.projects,
        entries: s.entries,
        atlases: s.atlases,
        manuscripts: s.manuscripts,
        images: s.images,
        seedFlag: s.seedFlag,
      }),
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

export const findProjectImage = (s: ProjectData, key?: string): string | undefined =>
  key ? s.images[key] : undefined;