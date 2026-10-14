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

export interface ProjectData {
  projects: Project[];
  entries: WorldEntry[];
  atlases: Atlas[];
  manuscripts: Manuscript[];
  images: Record<string, string>;
}

export const ENTRY_CATEGORIES: readonly EntryCategory[] = [
  "person", "place", "faction", "event", "item", "lore",
] as const;

export const PIN_TYPES: readonly PinType[] = ["place", "person", "event", "item"] as const;
