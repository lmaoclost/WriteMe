import type {
  ProjectData, WorldEntry, Atlas, Manuscript, Region, Pin, Project,
  Bloodline, BloodlinePerson, BloodlineHouse, BloodlineTitle, BloodlineTenure,
  FactionWeb, Faction, FactionConnection,
  CustomCalendar, CalendarEvent, EntrySection,
  PlotBoard, PlotCard, PlotWire, PlotPart,
  TimelineWire, TimelineBead, TimelineSegment,
  OathsChart, OathMember, OathLink,
  WellSpring, WellNode, WellBorder,
  Conlang, ConlangGlyph, ConlangWord,
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
    && isStr(e.body) && isArr(e.links) && e.links.every(isStr) && optionalStr(e.imageKey)
    && optionalStr(e.summary) && optionalStr(e.date)
    && (e.sections === undefined
      || (isArr(e.sections) && e.sections.every((sec) =>
        !!sec && isStr((sec as EntrySection).name)
        && isArr((sec as EntrySection).fields)
        && (sec as EntrySection).fields.every((f) => !!f && isStr(f.label) && isStr(f.content)))));
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
  return !!c && isStr(c.id) && isStr(c.heading) && isStr(c.content) && isNum(c.order)
    && optionalStr(c.noteTop) && optionalStr(c.noteEnd) && optionalStr(c.endMarker)
    && optionalStr(c.linkedCalendarId) && optionalStr(c.calendarDayKey);
};

export const BIND_TRIMS = ["6x9", "5x8", "5.5x8.5", "5.25x8", "6.14x9.21", "7x10"];
export const BIND_NUM_STYLES = ["none", "arabic", "chapter", "word"] as const;
export const BIND_HEAD_MODES = ["book", "chapter"] as const;
export function defaultBindery() {
  return { font: "Georgia, serif", trim: "6x9", dropCaps: false, runningHead: true, titlePage: true, toc: true, glossary: false, numberingStyle: "arabic", pageNumbers: false, runningHeadMode: "book" };
}
const isBindery = (v: unknown): boolean => {
  const b = v as Manuscript["bindery"];
  return !!b && isStr(b.font) && isStr(b.trim) && (BIND_TRIMS as string[]).includes(b.trim)
    && typeof b.dropCaps === "boolean" && typeof b.runningHead === "boolean"
    && typeof b.titlePage === "boolean" && typeof b.toc === "boolean" && typeof b.glossary === "boolean"
    && optionalStr(b.dedication)
    && (b.numberingStyle === undefined || (BIND_NUM_STYLES as readonly string[]).includes(b.numberingStyle))
    && (b.runningHeadMode === undefined || (BIND_HEAD_MODES as readonly string[]).includes(b.runningHeadMode))
    && (b.pageNumbers === undefined || typeof b.pageNumbers === "boolean");
};

const isManuscript = (v: unknown): v is Manuscript => {
  const m = v as Manuscript;
  return !!m && isStr(m.id) && isStr(m.projectId) && isStr(m.title) && isStr(m.author)
    && isArr(m.chapters) && m.chapters.every(isChapter)
    && (m.bindery === undefined || isBindery(m.bindery));
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

const CONNECTION_TYPES: readonly string[] = ["ally", "rival", "vassal", "trade", "neutral"];

const isFaction = (v: unknown): v is Faction => {
  const f = v as Faction;
  return !!f && isStr(f.id) && isNum(f.x) && isNum(f.y) && isStr(f.name) && isStr(f.color)
    && optionalStr(f.leader) && optionalStr(f.territory) && optionalStr(f.goals) && optionalStr(f.description);
};

const isFactionConnection = (v: unknown): v is FactionConnection => {
  const c = v as FactionConnection;
  return !!c && isStr(c.id) && isStr(c.fromId) && isStr(c.toId) && (CONNECTION_TYPES as readonly string[]).includes(c.type);
};

const isFactionWeb = (v: unknown): v is FactionWeb => {
  const w = v as FactionWeb;
  return !!w && isStr(w.id) && isStr(w.projectId) && isStr(w.name)
    && isArr(w.factions) && w.factions.every(isFaction)
    && isArr(w.connections) && w.connections.every(isFactionConnection)
    && isStr(w.notes);
};

const isCalendarEvent = (v: unknown): v is CalendarEvent => {
  const e = v as CalendarEvent;
  return !!e && isStr(e.id) && isStr(e.text) && isStr(e.category) && optionalStr(e.color);
};

const isCustomCalendar = (v: unknown): v is CustomCalendar => {
  const c = v as CustomCalendar;
  return !!c && isStr(c.id) && isStr(c.projectId) && isStr(c.name)
    && isArr(c.months) && c.months.every((m) => {
      const mm = m as { name: unknown; days: unknown };
      return !!mm && isStr(mm.name) && isNum(mm.days) && (mm.days as number) >= 1;
    })
    && isArr(c.weekdays) && c.weekdays.every(isStr)
    && isArr(c.weekendDays) && c.weekendDays.every(isNum)
    && !!c.events && Object.values(c.events).every((evs) => isArr(evs) && evs.every(isCalendarEvent))
    && isNum(c.startingWeekday)
    && isStr(c.notes)
    && optionalStr(c.era);
};

const isPlotPart = (v: unknown): boolean => {
  const t = v as PlotPart;
  return !!t && isStr(t.id) && isStr(t.text);
};

const isPlotCard = (v: unknown): boolean => {
  const c = v as PlotCard;
  return !!c && isStr(c.id) && isStr(c.actId) && isNum(c.x) && isNum(c.y)
    && isStr(c.title) && isStr(c.pov) && isStr(c.location) && isStr(c.color)
    && isArr(c.parts) && c.parts.every(isPlotPart)
    && optionalStr(c.locationEntryId);
};

const isPlotBoard = (v: unknown): boolean => {
  const b = v as PlotBoard;
  return !!b && isStr(b.id) && isStr(b.projectId) && isStr(b.name)
    && isArr(b.acts) && b.acts.every((a) => !!a && isStr((a as PlotBoard["acts"][number]).id) && isStr((a as PlotBoard["acts"][number]).name))
    && typeof b.hasPrologue === "boolean" && typeof b.hasEpilogue === "boolean"
    && isArr(b.cards) && b.cards.every(isPlotCard)
    && isArr(b.wires) && b.wires.every((w) => {
      const wf = w as PlotWire;
      return !!wf && isStr(wf.id) && isStr(wf.fromCardId) && isStr(wf.toCardId);
    })
    && isStr(b.notes);
};

const isTimelineBead = (v: unknown): boolean => {
  const b = v as TimelineBead;
  return !!b && isStr(b.id) && isNum(b.x) && isNum(b.y) && isStr(b.label) && isStr(b.color)
    && optionalStr(b.dateText) && optionalStr(b.summary);
};

const isTimelineSegment = (v: unknown): boolean => {
  const g = v as TimelineSegment;
  return !!g && isStr(g.id) && isNum(g.fromX) && isNum(g.toX) && isStr(g.label) && isStr(g.lineColor);
};

const isTimelineWire = (v: unknown): boolean => {
  const t = v as TimelineWire;
  return !!t && isStr(t.id) && isStr(t.projectId) && isStr(t.name)
    && isArr(t.beads) && t.beads.every(isTimelineBead)
    && isArr(t.segments) && t.segments.every(isTimelineSegment)
    && isStr(t.notes);
};

const OATH_SEAT_STATUS = ["held", "vacant", "disputed"];
const OATH_LINK_STATUS = ["sworn", "strained", "broken"];
const OATH_KINDS = ["primary", "joint"];

const isOathMember = (v: unknown): boolean => {
  const m = v as OathMember;
  return !!m && isStr(m.id) && isStr(m.name) && isStr(m.color)
    && (OATH_SEAT_STATUS as string[]).includes(m.seatStatus)
    && optionalStr(m.title) && optionalStr(m.org) && optionalStr(m.notes);
};

const isOathLink = (v: unknown): boolean => {
  const l = v as OathLink;
  return !!l && isStr(l.id) && isStr(l.subordinateId) && isStr(l.superiorId)
    && (OATH_KINDS as string[]).includes(l.kind)
    && (OATH_LINK_STATUS as string[]).includes(l.status);
};

const isOathsChart = (v: unknown): boolean => {
  const c = v as OathsChart;
  return !!c && isStr(c.id) && isStr(c.projectId) && isStr(c.name)
    && isArr(c.members) && c.members.every(isOathMember)
    && isArr(c.oathLinks) && c.oathLinks.every(isOathLink)
    && isStr(c.notes);
};

const WELL_KINDS = ["character", "setting", "conflict", "question"];

const isWellNode = (v: unknown): boolean => {
  const n = v as WellNode;
  return !!n && isStr(n.id) && (WELL_KINDS as string[]).includes(n.kind)
    && isNum(n.x) && isNum(n.y) && isStr(n.text);
};

const isWellBorder = (v: unknown): boolean => {
  const b = v as WellBorder;
  return !!b && isStr(b.id) && isStr(b.fromId) && isStr(b.toId) && isStr(b.label);
};

const isWellSpring = (v: unknown): boolean => {
  const w = v as WellSpring;
  return !!w && isStr(w.id) && isStr(w.projectId) && isStr(w.name)
    && isArr(w.nodes) && w.nodes.every(isWellNode)
    && isArr(w.borders) && w.borders.every(isWellBorder)
    && isStr(w.notes);
};

const isConlangGlyph = (v: unknown): boolean => {
  const g = v as ConlangGlyph;
  return !!g && isStr(g.id) && isStr(g.char) && (g.char as string).length <= 3 && isStr(g.svgPath);
};

const isConlangWord = (v: unknown): boolean => {
  const w = v as ConlangWord;
  return !!w && isStr(w.id) && isStr(w.word) && isStr(w.meaning) && isStr(w.pos) && isStr(w.theme);
};

const isConlang = (v: unknown): boolean => {
  const c = v as Conlang;
  return !!c && isStr(c.id) && isStr(c.projectId) && isStr(c.name)
    && isArr(c.glyphs) && c.glyphs.every(isConlangGlyph)
    && isArr(c.words) && c.words.every(isConlangWord)
    && isStr(c.notes);
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
      || (isArr(d.bloodlines) && d.bloodlines.every(isBloodline)))
    && (d.factionWebs === undefined
      || (isArr(d.factionWebs) && d.factionWebs.every(isFactionWeb)))
    && (d.calendars === undefined
      || (isArr(d.calendars) && d.calendars.every(isCustomCalendar)))
    && (d.plotBoards === undefined
      || (isArr(d.plotBoards) && d.plotBoards.every(isPlotBoard)))
    && (d.timelines === undefined
      || (isArr(d.timelines) && d.timelines.every(isTimelineWire)))
    && (d.oathsCharts === undefined
      || (isArr(d.oathsCharts) && d.oathsCharts.every(isOathsChart)))
    && (d.wellsprings === undefined
      || (isArr(d.wellsprings) && d.wellsprings.every(isWellSpring)))
    && (d.conlangs === undefined
      || (isArr(d.conlangs) && d.conlangs.every(isConlang)));
}

/** Fresh shape: bloodlines is optional in the schema but a fresh state always carries []. */
export function emptyProjectData(): ProjectData & { bloodlines: Bloodline[] } {
  return { projects: [], entries: [], atlases: [], manuscripts: [], images: {}, bloodlines: [], factionWebs: [], calendars: [], plotBoards: [], timelines: [], oathsCharts: [], wellsprings: [], conlangs: [] };
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
    factionWebs: d.factionWebs ?? [],
    calendars: d.calendars ?? [],
    plotBoards: d.plotBoards ?? [],
    timelines: d.timelines ?? [],
    oathsCharts: d.oathsCharts ?? [],
    wellsprings: d.wellsprings ?? [],
    conlangs: d.conlangs ?? [],
  };
}
