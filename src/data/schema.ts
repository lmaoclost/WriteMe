import type {
  ProjectData, WorldEntry, Atlas, Manuscript, Region, Pin, Project,
  Bloodline, BloodlinePerson, BloodlineHouse, BloodlineTitle, BloodlineTenure,
} from "../domain/types";
import { ENTRY_CATEGORIES, PIN_TYPES } from "../domain/types";

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const norm01 = (v: unknown): boolean => isNum(v) && v >= 0 && v <= 1;
const optionalStr = (v: unknown): boolean => v === undefined || isStr(v);
const optionalNum = (v: unknown): boolean => v === undefined || isNum(v);

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

const isBloodlineTitle = (v: unknown): v is BloodlineTitle => {
  const t = v as BloodlineTitle;
  return !!t && isStr(t.title);
};

const isBloodlineTenure = (v: unknown): v is BloodlineTenure => {
  const t = v as BloodlineTenure;
  return !!t && isStr(t.label) && isStr(t.from) && isStr(t.to);
};

const isBloodlinePerson = (v: unknown): v is BloodlinePerson => {
  const p = v as BloodlinePerson;
  return !!p && isStr(p.id) && isNum(p.x) && isNum(p.y) && isStr(p.name)
    && isArr(p.additionalTitles) && p.additionalTitles.every(isBloodlineTitle)
    && isArr(p.tenures) && p.tenures.every(isBloodlineTenure)
    && isBool(p.showBadge) && isStr(p.badgeText) && isBool(p.isTwin)
    && optionalStr(p.suffix) && optionalStr(p.portraitKey) && optionalStr(p.title)
    && optionalStr(p.relationship) && optionalStr(p.bio)
    && optionalStr(p.birthDate) && optionalStr(p.deathDate)
    && optionalStr(p.connectedTo) && optionalStr(p.siblingId) && optionalStr(p.partnerId)
    && optionalNum(p.birthOrder);
};

const isBloodlineHouse = (v: unknown): v is BloodlineHouse => {
  const h = v as BloodlineHouse;
  return !!h && isStr(h.id) && isNum(h.x) && isNum(h.y) && isStr(h.name)
    && isBool(h.isMainBranch) && isBool(h.isMonarch) && optionalStr(h.subtitle);
};

const isBloodline = (v: unknown): v is Bloodline => {
  const b = v as Bloodline;
  return !!b && isStr(b.id) && isStr(b.projectId) && isStr(b.name)
    && isArr(b.persons) && b.persons.every(isBloodlinePerson)
    && isArr(b.houses) && b.houses.every(isBloodlineHouse)
    && isStr(b.notes);
};

export function validateProjectData(v: unknown): boolean {
  const d = v as ProjectData;
  return !!d && isArr(d.projects) && d.projects.every(isProject)
    && isArr(d.entries) && d.entries.every(isEntry)
    && isArr(d.atlases) && d.atlases.every(isAtlas)
    && isArr(d.manuscripts) && d.manuscripts.every(isManuscript)
    && !!d.images && Object.values(d.images).every(isStr)
    && (d.bloodlines === undefined
      || (isArr(d.bloodlines) && d.bloodlines.every(isBloodline)));
}

/** Fresh shape: bloodlines is optional in the schema but a fresh state always carries []. */
export function emptyProjectData(): ProjectData & { bloodlines: Bloodline[] } {
  return { projects: [], entries: [], atlases: [], manuscripts: [], images: {}, bloodlines: [] };
}

export function serialize(data: ProjectData): string {
  return JSON.stringify({ app: "scriptorium", version: 2, ...data });
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
  if (d.version !== 1 && d.version !== 2) throw new Error(`Versão ${String(d.version)} não suportada.`);
  if (!validateProjectData(d)) throw new Error("Arquivo com estrutura inválida.");
  return {
    projects: d.projects,
    entries: d.entries,
    atlases: d.atlases,
    manuscripts: d.manuscripts,
    images: d.images,
    bloodlines: d.bloodlines ?? [],
  };
}
