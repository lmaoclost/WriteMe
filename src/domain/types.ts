export type Id = string;

export type EntryCategory = "person" | "place" | "faction" | "event" | "item" | "lore";

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
  content: string;
  order: number;
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

export interface ProjectData {
  projects: Project[];
  entries: WorldEntry[];
  atlases: Atlas[];
  manuscripts: Manuscript[];
  images: Record<string, string>;
  bloodlines?: Bloodline[];
  factionWebs?: FactionWeb[];
}

export const ENTRY_CATEGORIES: readonly EntryCategory[] = [
  "person", "place", "faction", "event", "item", "lore",
] as const;

export const PIN_TYPES: readonly PinType[] = ["place", "person", "event", "item"] as const;
