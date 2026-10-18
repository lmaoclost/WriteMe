export type Id = string;

export type EntryCategory =
  | "nation" | "character" | "creature" | "location" | "flora" | "material"
  | "technology" | "magic" | "culture" | "artifact" | "language" | "event"
  | "faction" | "deity" | "lore"
  | "person" | "place" | "item"; // legacy v1 keys, still valid

export interface EntrySectionField { label: string; content: string; id?: string }
export interface EntrySection { name: string; fields: EntrySectionField[]; id?: string }

export type EntryKind = {
  key: string;
  label: string;
  icon: string;
  color?: string;
};

export interface Project {
  id: Id;
  name: string;
  description: string;
  coverImageKey?: string;
  /** user-defined entry kinds (label + emoji) — category key = slug(label) */
  customCategories?: EntryKind[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldEntry {
  id: Id;
  projectId: Id;
  title: string;
  category: string;
  body: string;
  imageKey?: string;
  focal?: [number, number]; // object-position enquadramento (0..1)
  links: Id[];
  date?: string;
  summary?: string;
  sections?: EntrySection[];
}

export interface Pt { x: number; y: number; }

export interface Region {
  id: Id;
  points: Pt[];
  color: string;
  fillOpacity: number;
  label: string;
  entryId?: Id;
}

export type PinType = "place" | "person" | "event" | "item";

export interface Pin {
  id: Id;
  x: number;
  y: number;
  type: PinType;
  color: string;
  label: string;
  entryId?: Id;
}

export interface Atlas {
  id: Id;
  projectId: Id;
  name: string;
  mapImageKey?: string;
  regions: Region[];
  pins: Pin[];
}

export type BinderPreset = "manuscript" | "classic" | "commercial" | "fantasy";
export type SceneOrnament = "blank" | "asterisks" | "asterism" | "fleuron" | "rule";

export type BinderyConfig = {
  font: string;           // stack do livro
  trim: string;           // "6x9" etc.
  dropCaps: boolean;
  runningHead: boolean;
  titlePage: boolean;
  dedication?: string;
  toc: boolean;
  glossary: boolean;
  numberingStyle?: "none" | "arabic" | "chapter" | "word";
  pageNumbers?: boolean;
  runningHeadMode?: "book" | "chapter";
  preset?: BinderPreset;
  typography?: { bodyPt: number; leading: number; indent: number; justify: boolean; hyphens: boolean };
  geometry?: { gutter: number | "auto"; mirrored: boolean };
  opener?: { sink: number; suppressHead: boolean; suppressFolio: boolean };
  frontMatter?: {
    halfTitle: boolean;
    copyright: boolean;
    copyrightInfo?: { year?: string; holder?: string; isbn?: string; edition?: string; rights?: string };
    epigraph?: string;
    romanNumerals: boolean;
  };
  backMatter?: { glossary: boolean; aboutAuthor?: string; colophon: boolean };
  sceneOrnament?: SceneOrnament;
};

/** Part divider of a manuscript: chapters reference it through Chapter.partId. */
export interface Part {
  id: Id;
  title: string;
  order: number;
  epigraph?: string;
}

export interface Chapter {
  id: Id;
  heading: string;
  /** Markdown by default; HTML when edited in the rich editor (starts with "<"). */
  content: string;
  order: number;
  noteTop?: string;
  noteEnd?: string;
  endMarker?: string;
  linkedCalendarId?: Id;
  calendarDayKey?: string; // "y:m:d" (calendar-relative)
  partId?: Id;
}

export interface Manuscript {
  id: Id;
  projectId: Id;
  title: string;
  author: string;
  chapters: Chapter[];
  parts?: Part[];
  bindery?: BinderyConfig;
}

export interface BloodlineTitle { title: string }

export interface BloodlineTenure { label: string; from: string; to: string }

/** Person of a genealogy canvas; coords are absolute canvas px (NOT normalized). */
export interface BloodlinePerson {
  id: Id;
  x: number;
  y: number;
  name: string;
  suffix?: string;
  portraitKey?: string;
  title?: string;
  relationship?: string;
  bio?: string;
  birthDate?: string;
  deathDate?: string;
  additionalTitles: BloodlineTitle[];
  tenures: BloodlineTenure[];
  showBadge: boolean;
  badgeText: string;
  connectedTo?: Id;
  siblingId?: Id;
  partnerId?: Id;
  houseId?: Id;
  birthOrder?: number;
  isTwin: boolean;
}

export interface BloodlineHouse {
  id: Id;
  x: number;
  y: number;
  name: string;
  subtitle?: string;
  isMainBranch: boolean;
  isMonarch: boolean;
}

export interface Bloodline {
  id: Id;
  projectId: Id;
  name: string;
  persons: BloodlinePerson[];
  houses: BloodlineHouse[];
  notes: string;
}

export type ConnectionType = "ally" | "rival" | "vassal" | "trade" | "neutral";

export type Faction = {
  id: Id;
  x: number;
  y: number;
  name: string;
  leader?: string;
  territory?: string;
  goals?: string;
  description?: string;
  color: string;
};

export type FactionConnection = {
  id: Id;
  fromId: Id;
  toId: Id;
  type: ConnectionType;
};

export type FactionWeb = {
  id: Id;
  projectId: Id;
  name: string;
  factions: Faction[];
  connections: FactionConnection[];
  notes: string;
};

export type CalendarEvent = { id: Id; text: string; category: string; color?: string };

export type CustomCalendar = {
  id: Id;
  projectId: Id;
  name: string;
  era?: string;
  months: { name: string; days: number }[];
  weekdays: string[];
  weekendDays: number[];
  events: Record<string, CalendarEvent[]>;
  startingWeekday: number;
  notes: string;
};

export type PlotPart = { id: Id; text: string };

export type PlotCard = {
  id: Id;
  actId: Id;
  x: number;
  y: number;
  title: string;
  pov: string;
  location: string;
  locationEntryId?: Id;
  parts: PlotPart[];
  color: string;
};

export type PlotWire = { id: Id; fromCardId: Id; toCardId: Id };

export type PlotBoard = {
  id: Id;
  projectId: Id;
  name: string;
  acts: { id: Id; name: string }[];
  hasPrologue: boolean;
  hasEpilogue: boolean;
  cards: PlotCard[];
  wires: PlotWire[];
  notes: string;
};

export type TimelineBead = {
  id: Id;
  x: number; // posição no fio (plane px)
  y: number; // offset perpendicular ao fio (negativo = acima)
  label: string;
  dateText?: string;
  summary?: string;
  color: string;
  entryId?: Id; // tome entry ligado ao evento
};

export type TimelineSegment = {
  id: Id;
  fromX: number;
  toX: number;
  label: string;
  lineColor: string;
};

export type TimelineWire = {
  id: Id;
  projectId: Id;
  name: string;
  beads: TimelineBead[];
  segments: TimelineSegment[];
  notes: string;
};

export type OathMember = {
  id: Id;
  name: string;
  title?: string;
  org?: string;
  notes?: string;
  seatStatus: "held" | "vacant" | "disputed";
  color: string;
  x?: number;
  y?: number;
};

export type OathLink = {
  id: Id;
  subordinateId: Id;
  superiorId: Id;
  kind: "primary" | "joint";
  status: "sworn" | "strained" | "broken";
};

export type OathsChart = {
  id: Id;
  projectId: Id;
  name: string;
  members: OathMember[];
  oathLinks: OathLink[];
  notes: string;
};

export type WellKind = "character" | "setting" | "conflict" | "question";

export type WellNode = {
  id: Id;
  kind: WellKind;
  x: number;
  y: number;
  text: string;
};

export type WellBorder = {
  id: Id;
  fromId: Id;
  toId: Id;
  label: string;
};

export type WellSpring = {
  id: Id;
  projectId: Id;
  name: string;
  nodes: WellNode[];
  borders: WellBorder[];
  notes: string;
};

export type ConlangGlyph = { id: Id; char: string; svgPath: string };
export type ConlangWord = { id: Id; word: string; meaning: string; pos: string; theme: string };

export type Conlang = {
  id: Id;
  projectId: Id;
  name: string;
  glyphs: ConlangGlyph[];
  words: ConlangWord[];
  notes: string;
};

export interface ProjectData {
  projects: Project[];
  entries: WorldEntry[];
  atlases: Atlas[];
  manuscripts: Manuscript[];
  images: Record<string, string>;
  bloodlines?: Bloodline[];
  factionWebs?: FactionWeb[];
  calendars?: CustomCalendar[];
  plotBoards?: PlotBoard[];
  timelines?: TimelineWire[];
  oathsCharts?: OathsChart[];
  wellsprings?: WellSpring[];
  conlangs?: Conlang[];
}

export const ENTRY_CATEGORIES: readonly EntryCategory[] = [
  "nation", "character", "creature", "location", "flora", "material",
  "technology", "magic", "culture", "artifact", "language", "event",
  "faction", "deity", "lore",
  "person", "place", "item",
] as const;

export const PIN_TYPES: readonly PinType[] = ["place", "person", "event", "item"] as const;
