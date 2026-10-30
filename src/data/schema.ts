import * as z from "zod/mini";
import type { ProjectData, Bloodline, Manuscript } from "../domain/types";
import { PIN_TYPES } from "../domain/types";
import type { PinType } from "../domain/types";

const s = z.string();
const n = z.number(); // Number.isFinite semantics: NaN/Infinity rejected
const b = z.boolean();
/** optional field of a typed kind */
const num01 = n.check(z.gte(0), z.lte(1));
const dotPath = (path: Array<string | number | symbol>): string =>
  path.map((p) => String(p)).join(".");

/** Categories are user-defined entry kinds — any string passes (see types.ts). */
const EntrySchema = z.object({
  id: s,
  projectId: s,
  title: s,
  category: s,
  body: s,
  links: z.array(s),
  imageKey: z.optional(s),
  focal: z.optional(z.tuple([num01, num01])),
  date: z.optional(s),
  summary: z.optional(s),
  sections: z.optional(
    z.array(
      z.object({
        name: s,
        id: z.optional(s),
        fields: z.array(
          z.object({
            label: s,
            content: s,
            id: z.optional(s),
          }),
        ),
      }),
    ),
  ),
});

const RegionSchema = z.object({
  id: s,
  points: z.array(
    z.object({ x: num01, y: num01 }),
  ),
  color: s,
  fillOpacity: z.optional(num01),
  label: s,
  entryId: z.optional(s),
});

const PinSchema = z.object({
  id: s,
  x: num01,
  y: num01,
  type: z.enum(PIN_TYPES as unknown as [PinType, ...PinType[]]),
  color: s,
  label: s,
  entryId: z.optional(s),
});

const AtlasSchema = z.object({
  id: s,
  projectId: s,
  name: s,
  mapImageKey: z.optional(s),
  regions: z.array(RegionSchema),
  pins: z.array(PinSchema),
});

const SceneSchema = z.object({
  id: s,
  title: z.optional(s),
  content: s,
  order: n,
});

const ChapterSchema = z.object({
  id: s,
  heading: s,
  /** 1+ cenas: o corpo do capítulo. Capítulos sem cenas (dados antigos) são rejeitados. */
  scenes: z.array(SceneSchema).check(z.minLength(1)),
  order: n,
  noteTop: z.optional(s),
  noteEnd: z.optional(s),
  endMarker: z.optional(s),
  linkedCalendarId: z.optional(s),
  calendarDayKey: z.optional(s),
  partId: z.optional(s),
});

const PartSchema = z.object({
  id: s,
  title: s,
  order: n,
  epigraph: z.optional(s),
});

export const BIND_TRIMS = ["6x9", "5x8", "5.5x8.5", "5.25x8", "6.14x9.21", "7x10"];
export const BIND_NUM_STYLES = ["none", "arabic", "chapter", "word"] as const;
export const BIND_HEAD_MODES = ["book", "chapter"] as const;
export const BIND_PRESETS = ["manuscript", "classic", "commercial", "fantasy"] as const;
export const BIND_SCENE_ORNAMENTS = ["none", "blank", "asterisks", "asterism", "fleuron", "rule"] as const;

export function defaultBindery(): Manuscript["bindery"] {
  return {
    font: '"EB Garamond", Garamond, "Book Antiqua", serif',
    trim: "6x9", dropCaps: true, runningHead: true, titlePage: true, toc: true,
    glossary: false, numberingStyle: "arabic", pageNumbers: true, runningHeadMode: "chapter",
    preset: "classic",
    typography: { bodyPt: 11, leading: 14.5, indent: 1, justify: true, hyphens: false },
    geometry: { gutter: "auto", mirrored: true },
    opener: { sink: 0.18, suppressHead: true, suppressFolio: true },
    frontMatter: { halfTitle: true, copyright: true, romanNumerals: true },
    sceneOrnament: "asterism",
  };
}

const BinderyTypographySchema = z.optional(z.object({
  bodyPt: z.optional(n),
  leading: z.optional(n),
  indent: z.optional(n),
  justify: z.optional(b),
  hyphens: z.optional(b),
}));

const BinderyGeometrySchema = z.optional(z.object({
  gutter: z.optional(z.union([n, z.literal("auto")])),
  mirrored: z.optional(b),
}));

const BinderyOpenerSchema = z.optional(z.object({
  sink: z.optional(n),
  suppressHead: z.optional(b),
  suppressFolio: z.optional(b),
}));

const BinderyFrontMatterSchema = z.optional(z.object({
  halfTitle: z.optional(b),
  copyright: z.optional(b),
  romanNumerals: z.optional(b),
  epigraph: z.optional(s),
  copyrightInfo: z.optional(
    z.object({
      year: z.optional(s),
      holder: z.optional(s),
      isbn: z.optional(s),
      edition: z.optional(s),
      rights: z.optional(s),
    }),
  ),
}));

const BinderyBackMatterSchema = z.optional(z.object({
  glossary: z.optional(b),
  colophon: z.optional(b),
  aboutAuthor: z.optional(s),
}));

const BinderySchema = z.object({
  font: s,
  trim: z.enum(BIND_TRIMS as unknown as [string, ...string[]]),
  dropCaps: b,
  runningHead: b,
  titlePage: b,
  toc: b,
  glossary: b,
  dedication: z.optional(s),
  numberingStyle: z.optional(z.enum(BIND_NUM_STYLES)),
  runningHeadMode: z.optional(z.enum(BIND_HEAD_MODES)),
  pageNumbers: z.optional(b),
  preset: z.optional(z.enum(BIND_PRESETS)),
  sceneOrnament: z.optional(z.enum(BIND_SCENE_ORNAMENTS)),
  typography: BinderyTypographySchema,
  geometry: BinderyGeometrySchema,
  opener: BinderyOpenerSchema,
  frontMatter: BinderyFrontMatterSchema,
  backMatter: BinderyBackMatterSchema,
});

const ManuscriptSchema = z.object({
  id: s,
  projectId: s,
  title: s,
  author: s,
  chapters: z.array(ChapterSchema),
  parts: z.optional(z.array(PartSchema)),
  bindery: z.optional(BinderySchema),
});

const ProjectSchema = z.object({
  id: s,
  name: s,
  description: s,
  coverImageKey: z.optional(s),
  createdAt: n,
  updatedAt: n,
  customCategories: z.optional(
    z.array(
      z.object({
        key: s,
        label: s,
        icon: s,
        color: z.optional(s),
      }),
    ),
  ),
});

const BloodlineTitleSchema = z.object({ title: s });
const BloodlineTenureSchema = z.object({ label: s, from: s, to: s });

const BloodlinePersonSchema = z.object({
  id: s,
  x: n,
  y: n,
  name: s,
  entryId: z.optional(s),
  suffix: z.optional(s),
  portraitKey: z.optional(s),
  title: z.optional(s),
  relationship: z.optional(s),
  bio: z.optional(s),
  birthDate: z.optional(s),
  deathDate: z.optional(s),
  additionalTitles: z.array(BloodlineTitleSchema),
  tenures: z.array(BloodlineTenureSchema),
  showBadge: b,
  badgeText: s,
  connectedTo: z.optional(s),
  siblingId: z.optional(s),
  partnerId: z.optional(s),
  houseId: z.optional(s),
  birthOrder: z.optional(n),
  isTwin: b,
});

const BloodlineHouseSchema = z.object({
  id: s,
  x: n,
  y: n,
  name: s,
  subtitle: z.optional(s),
  isMainBranch: b,
  isMonarch: b,
});

const BloodlineSchema = z.object({
  id: s,
  projectId: s,
  name: s,
  persons: z.array(BloodlinePersonSchema),
  houses: z.array(BloodlineHouseSchema),
  notes: s,
});

const FactionSchema = z.object({
  id: s,
  x: n,
  y: n,
  name: s,
  leader: z.optional(s),
  territory: z.optional(s),
  territoryRegionId: z.optional(s),
  goals: z.optional(s),
  description: z.optional(s),
  color: s,
});

const FactionConnectionSchema = z.object({
  id: s,
  fromId: s,
  toId: s,
  type: z.enum(["ally", "rival", "vassal", "trade", "neutral"]),
});

const FactionWebSchema = z.object({
  id: s,
  projectId: s,
  name: s,
  factions: z.array(FactionSchema),
  connections: z.array(FactionConnectionSchema),
  notes: s,
});

const CalendarEventSchema = z.object({
  id: s,
  text: s,
  category: s,
  color: z.optional(s),
});

const CustomCalendarSchema = z.object({
  id: s,
  projectId: s,
  name: s,
  era: z.optional(s),
  months: z.array(z.object({ name: s, days: n.check(z.gt(0)) })),
  weekdays: z.array(s),
  weekendDays: z.array(n),
  events: z.record(z.string(), z.array(CalendarEventSchema)),
  startingWeekday: n,
  notes: s,
});

const PlotPartSchema = z.object({ id: s, text: s });

const PlotCardSchema = z.object({
  id: s,
  actId: s,
  x: n,
  y: n,
  title: s,
  pov: s,
  location: s,
  locationEntryId: z.optional(s),
  parts: z.array(PlotPartSchema),
  color: s,
});

const PlotBoardSchema = z.object({
  id: s,
  projectId: s,
  name: s,
  acts: z.array(z.object({ id: s, name: s })),
  hasPrologue: b,
  hasEpilogue: b,
  cards: z.array(PlotCardSchema),
  wires: z.array(z.object({ id: s, fromCardId: s, toCardId: s })),
  notes: s,
});

const CalendarEventRefSchema = z.object({
  calendarId: s,
  dayKey: s,
  eventId: s,
});

const TimelineBeadSchema = z.object({
  id: s,
  x: n,
  y: n,
  label: s,
  dateText: z.optional(s),
  summary: z.optional(s),
  color: s,
  entryId: z.optional(s),
  calendarEvent: z.optional(CalendarEventRefSchema),
  origin: z.optional(z.literal(true)),
});

const TimelineEraSchema = z.object({
  id: s,
  startX: n,
  boundaryBeadId: z.optional(s),
  label: s,
  lineColor: s,
});

const TimelineWireSchema = z.object({
  id: s,
  projectId: s,
  name: s,
  beads: z.array(TimelineBeadSchema),
  eras: z.array(TimelineEraSchema),
  notes: s,
});

const OATH_SEAT_STATUS = ["held", "vacant", "disputed"] as const;
const OATH_LINK_STATUS = ["sworn", "strained", "broken"] as const;
const OATH_KINDS = ["primary", "joint"] as const;

const OathMemberSchema = z.object({
  id: s,
  name: s,
  title: z.optional(s),
  org: z.optional(s),
  notes: z.optional(s),
  seatStatus: z.enum(OATH_SEAT_STATUS),
  color: s,
  x: z.optional(n),
  y: z.optional(n),
});

const OathLinkSchema = z.object({
  id: s,
  subordinateId: s,
  superiorId: s,
  kind: z.enum(OATH_KINDS),
  status: z.enum(OATH_LINK_STATUS),
});

const OathsChartSchema = z.object({
  id: s,
  projectId: s,
  name: s,
  members: z.array(OathMemberSchema),
  oathLinks: z.array(OathLinkSchema),
  notes: s,
});

const WELL_KINDS = ["character", "setting", "conflict", "question"] as const;

const WellNodeSchema = z.object({
  id: s,
  kind: z.enum(WELL_KINDS),
  x: n,
  y: n,
  text: s,
});

const WellBorderSchema = z.object({
  id: s,
  fromId: s,
  toId: s,
  label: s,
});

const WellSpringSchema = z.object({
  id: s,
  projectId: s,
  name: s,
  nodes: z.array(WellNodeSchema),
  borders: z.array(WellBorderSchema),
  notes: s,
});

const ConlangGlyphSchema = z.object({
  id: s,
  char: s.check(z.maxLength(3)),
  svgPath: s,
});

const ConlangWordSchema = z.object({
  id: s,
  word: s,
  meaning: s,
  pos: s,
  theme: s,
});

const ConlangSchema = z.object({
  id: s,
  projectId: s,
  name: s,
  glyphs: z.array(ConlangGlyphSchema),
  words: z.array(ConlangWordSchema),
  notes: s,
});

const ImagesSchema = z.record(z.string(), s.check(z.startsWith("data:image/")));

/** Fresh shape: bloodlines etc. are OPTIONAL in the schema but a fresh state
 *  always carries []. */
const ProjectDataSchema = z.object({
  projects: z.array(ProjectSchema),
  entries: z.array(EntrySchema),
  atlases: z.array(AtlasSchema),
  manuscripts: z.array(ManuscriptSchema),
  images: ImagesSchema,
  bloodlines: z.optional(z.array(BloodlineSchema)),
  factionWebs: z.optional(z.array(FactionWebSchema)),
  calendars: z.optional(z.array(CustomCalendarSchema)),
  plotBoards: z.optional(z.array(PlotBoardSchema)),
  timelines: z.optional(z.array(TimelineWireSchema)),
  oathsCharts: z.optional(z.array(OathsChartSchema)),
  wellsprings: z.optional(z.array(WellSpringSchema)),
  conlangs: z.optional(z.array(ConlangSchema)),
});

/** Boolean contract preserved for storage/load round-trips; no output reuse. */
export function validateProjectData(v: unknown): boolean {
  return ProjectDataSchema.safeParse(v).success;
}

export interface ValidatedIssue {
  path: string;
  message: string;
}

/** Detailed diagnostics for the import UI: dot paths + zod messages. */
export function validateProjectDataDetailed(v: unknown): ValidatedIssue[] {
  const result = ProjectDataSchema.safeParse(v);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: dotPath(issue.path) || "(root)",
    message: issue.message,
  }));
}

export function emptyProjectData(): ProjectData & { bloodlines: Bloodline[] } {
  return { projects: [], entries: [], atlases: [], manuscripts: [], images: {}, bloodlines: [], factionWebs: [], calendars: [], plotBoards: [], timelines: [], oathsCharts: [], wellsprings: [], conlangs: [] };
}

export function serialize(data: ProjectData): string {
  return JSON.stringify({ app: "writeme", version: 1, ...data });
}

export type ParseExportErrorCode = "invalidJson" | "notWriteme" | "unsupportedVersion" | "invalidStructure";

/** Stable code so callers can translate the message in the active locale. */
export class ParseExportError extends Error {
  constructor(readonly code: ParseExportErrorCode, readonly version?: unknown, readonly details?: string) {
    super(code);
    this.name = "ParseExportError";
  }
}

export function parseExport(text: string): ProjectData {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new ParseExportError("invalidJson");
  }
  const d = doc as { app?: unknown; version?: unknown } & ProjectData;
  if (!d || d.app !== "writeme") throw new ParseExportError("notWriteme");
  if (d.version !== 1) throw new ParseExportError("unsupportedVersion", d.version);
  const issues = validateProjectDataDetailed(d);
  if (issues.length > 0) {
    throw new ParseExportError("invalidStructure", undefined, issues.slice(0, 5).map((i) => `${i.path}: ${i.message}`).join("; "));
  }
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
