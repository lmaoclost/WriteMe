import type { ProjectData, WorldEntry, Atlas, Manuscript, Region, Pin, Project } from "../domain/types";
import { ENTRY_CATEGORIES, PIN_TYPES } from "../domain/types";

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const norm01 = (v: unknown): boolean => isNum(v) && v >= 0 && v <= 1;
const optionalStr = (v: unknown): boolean => v === undefined || isStr(v);

const isEntry = (v: unknown): v is WorldEntry => {
  const e = v as WorldEntry;
  return !!e && isStr(e.id) && isStr(e.projectId) && isStr(e.title)
    && (ENTRY_CATEGORIES as readonly string[]).includes(e.category)
    && isStr(e.body) && isArr(e.links) && e.links.every(isStr) && optionalStr(e.imageKey);
};

const isRegion = (v: unknown): v is Region => {
  const r = v as Region;
  return !!r && isStr(r.id) && isArr(r.points) && r.points.every((p) => {
    const q = p as { x: unknown; y: unknown };
    return !!q && norm01(q.x) && norm01(q.y);
  }) && isStr(r.color) && (r.fillOpacity === undefined || norm01(r.fillOpacity)) && isStr(r.label)
    && optionalStr(r.entryId);
};

const isPin = (v: unknown): v is Pin => {
  const p = v as Pin;
  return !!p && isStr(p.id) && norm01(p.x) && norm01(p.y)
    && (PIN_TYPES as readonly string[]).includes(p.type) && isStr(p.color) && isStr(p.label)
    && optionalStr(p.entryId);
};

const isAtlas = (v: unknown): v is Atlas => {
  const a = v as Atlas;
  return !!a && isStr(a.id) && isStr(a.projectId) && isStr(a.name)
    && isArr(a.regions) && a.regions.every(isRegion)
    && isArr(a.pins) && a.pins.every(isPin) && optionalStr(a.mapImageKey);
};

const isChapter = (v: unknown): boolean => {
  const c = v as Manuscript["chapters"][number];
  return !!c && isStr(c.id) && isStr(c.heading) && isStr(c.content) && isNum(c.order);
};

const isManuscript = (v: unknown): v is Manuscript => {
  const m = v as Manuscript;
  return !!m && isStr(m.id) && isStr(m.projectId) && isStr(m.title) && isStr(m.author)
    && isArr(m.chapters) && m.chapters.every(isChapter);
};

const isProject = (v: unknown): v is Project => {
  const p = v as Project;
  return !!p && isStr(p.id) && isStr(p.name) && isStr(p.description)
    && isNum(p.createdAt) && isNum(p.updatedAt) && optionalStr(p.coverImageKey);
};

export function validateProjectData(v: unknown): boolean {
  const d = v as ProjectData;
  return !!d && isArr(d.projects) && d.projects.every(isProject)
    && isArr(d.entries) && d.entries.every(isEntry)
    && isArr(d.atlases) && d.atlases.every(isAtlas)
    && isArr(d.manuscripts) && d.manuscripts.every(isManuscript)
    && !!d.images && Object.values(d.images).every(isStr);
}

export function emptyProjectData(): ProjectData {
  return { projects: [], entries: [], atlases: [], manuscripts: [], images: {} };
}

export function serialize(data: ProjectData): string {
  return JSON.stringify({ app: "scriptorium", version: 1, ...data });
}

export function parseExport(text: string): ProjectData {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error("Arquivo não é JSON válido.");
  }
  const d = doc as { app?: unknown; version?: unknown } & ProjectData;
  if (!d || d.app !== "scriptorium") throw new Error("Arquivo não é um export do scriptorium.");
  if (d.version !== 1) throw new Error(`Versão ${String(d.version)} não suportada.`);
  if (!validateProjectData(d)) throw new Error("Arquivo com estrutura inválida.");
  return { projects: d.projects, entries: d.entries, atlases: d.atlases, manuscripts: d.manuscripts, images: d.images };
}
