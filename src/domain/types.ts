export type Id = string;

export type EntryCategory =
  | "nation" | "character" | "creature" | "location" | "flora" | "material"
  | "technology" | "magic" | "culture" | "artifact" | "language" | "event"
  | "faction" | "deity" | "lore"
  | "person" | "place" | "item"; // legacy v1 keys, still valid

export interface EntrySectionField { label: string; content: string }
export interface EntrySection { name: string; fields: EntrySectionField[] }

export interface Project {
  id: Id;
  name: string;
  description: string;
  coverImageKey?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorldEntry {
  id: Id;
  projectId: Id;
  title: string;
  category: EntryCategory;
  body: string;
  imageKey?: string;
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
}

export interface Manuscript {
  id: Id;
  projectId: Id;
  title: string;
  author: string;
  chapters: Chapter[];
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
}

export const ENTRY_CATEGORIES: readonly EntryCategory[] = [
  "nation", "character", "creature", "location", "flora", "material",
  "technology", "magic", "culture", "artifact", "language", "event",
  "faction", "deity", "lore",
  "person", "place", "item",
] as const;

export const PIN_TYPES: readonly PinType[] = ["place", "person", "event", "item"] as const;
