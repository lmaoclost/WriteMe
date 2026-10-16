export interface GenreGroup { label: string; options: string[] }
export interface TagGroup { label: string; tags: { value: string; label: string }[] }
export interface ContentWarning { value: string; label: string; description: string }

export const GENRE_GROUPS: GenreGroup[] = [
  { label: "Fantasy", options: ["Epic Fantasy", "High Fantasy", "Low Fantasy", "Sword & Sorcery", "Dark Fantasy / Grimdark", "Mythic", "Historical Fantasy", "Fairy Tale / Folklore", "Wuxia / Xianxia", "Portal Fantasy"] },
  { label: "Adventure", options: ["Classic Adventure", "Action Adventure", "Pulp Adventure", "Pirate / Nautical", "Survival", "Western / Weird West", "Lost World"] },
  { label: "Punk / Retro-Future", options: ["Steampunk", "Dieselpunk", "Solarpunk", "Atompunk", "Clockpunk"] },
  { label: "Science Fiction", options: ["Space Opera", "Cyberpunk", "Post-Apocalyptic", "Dystopian", "Time Travel"] },
  { label: "Romance", options: ["Romantasy", "Paranormal Romance", "Gothic Romance", "Historical Romance", "Regency Romance"] },
  { label: "Mystery / Thriller", options: ["Mystery / Detective", "Noir", "Thriller"] },
  { label: "Cozy / Slice of Life", options: ["Cozy Fantasy", "Cozy Mystery", "Slice of Life"] },
  { label: "Other", options: ["Gothic", "Cosmic Horror", "Mythological Retelling", "Alternate History", "Political Fiction"] },
];

export const TAG_GROUPS: TagGroup[] = [
  { label: "Lead Archetype", tags: [
    { value: "strong-lead", label: "Strong Lead" },
    { value: "antihero-lead", label: "Antihero Lead" },
    { value: "female-lead", label: "Female Lead" },
    { value: "male-lead", label: "Male Lead" },
    { value: "multiple-leads", label: "Multiple Leads" },
    { value: "morally-grey-lead", label: "Morally Grey Lead" },
    { value: "reluctant-hero", label: "Reluctant Hero" },
    { value: "villain-protagonist", label: "Villain Protagonist" },
  ] },
  { label: "Themes", tags: [
    { value: "magic-system", label: "Magic System" },
    { value: "mystery", label: "Mystery" },
    { value: "adventure", label: "Adventure" },
    { value: "romance-subplot", label: "Romance Subplot" },
    { value: "tragedy", label: "Tragedy" },
    { value: "coming-of-age", label: "Coming of Age" },
    { value: "redemption-arc", label: "Redemption Arc" },
    { value: "found-family", label: "Found Family" },
    { value: "faith-and-gods", label: "Faith & Gods" },
    { value: "revenge", label: "Revenge" },
    { value: "prophecy", label: "Prophecy" },
    { value: "lost-civilization", label: "Lost Civilization" },
  ] },
  { label: "Narrative Devices", tags: [
    { value: "first-person", label: "First Person" },
    { value: "multiple-pov", label: "Multiple POVs" },
    { value: "non-linear", label: "Non-Linear" },
    { value: "slow-burn", label: "Slow Burn" },
    { value: "fast-paced", label: "Fast-Paced" },
  ] },
  { label: "Hooks", tags: [
    { value: "reincarnation", label: "Reincarnation" },
    { value: "dragons", label: "Dragons" },
    { value: "necromancy", label: "Necromancy" },
    { value: "time-travel", label: "Time Travel" },
    { value: "heist", label: "Heist" },
    { value: "survival", label: "Survival" },
  ] },
];

export const CONTENT_WARNINGS: ContentWarning[] = [
  { value: "profanity", label: "Profanity", description: "Strong language used regularly." },
  { value: "gore", label: "Gore", description: "Graphic violence or body horror." },
  { value: "sexual-content", label: "Sexual Content", description: "Explicit sexual scenes." },
  { value: "traumatising-content", label: "Traumatising Content", description: "Abuse, suicide, or other heavy topics depicted on-page." },
  { value: "ai-imagery", label: "AI-Generated Cover", description: "Cover art generated with AI tools." },
];

const TAG_INDEX = new Map(TAG_GROUPS.flatMap((g) => g.tags.map((t) => [t.value, t.label] as const)));
const WARNING_INDEX = new Map(CONTENT_WARNINGS.map((w) => [w.value, w.label] as const));

export function tagLabelOf(id: string): string {
  return TAG_INDEX.get(id) ?? id;
}

export function warningLabelOf(id: string): string {
  return WARNING_INDEX.get(id) ?? id;
}

export type ManuscriptStatus = "ongoing" | "completed" | "hiatus";

export interface SampleManuscript {
  id: string;
  name: string;
  author: string;
  status: ManuscriptStatus;
  genres: string[];
  tags: string[];
  contentWarnings: string[];
  avgRating: number;
  reviewCount: number;
  chapterCount: number;
  synopsis?: string;
  releaseSchedule?: string;
}

export const SAMPLE_MANUSCRIPTS: SampleManuscript[] = [
  { id: "m1", name: "The Amber Seal", author: "Ines Barros", status: "ongoing", genres: ["High Fantasy", "Romantasy"], tags: ["strong-lead", "magic-system", "slow-burn"], contentWarnings: ["gore"], avgRating: 4.6, reviewCount: 12, chapterCount: 23, synopsis: "A chart-maker discovers the map of her capital is redrawing itself.", releaseSchedule: "New chapters Thursdays" },
  { id: "m2", name: "Salt and Static", author: "O. Vasquez", status: "completed", genres: ["Post-Apocalyptic"], tags: ["multiple-pov", "found-family"], contentWarnings: ["profanity", "gore"], avgRating: 4.2, reviewCount: 8, chapterCount: 41 },
  { id: "m3", name: "Clockpunk Carnival", author: "Ito Ren", status: "hiatus", genres: ["Steampunk", "Slice of Life"], tags: ["reluctant-hero", "found-family"], contentWarnings: [], avgRating: 0, reviewCount: 0, chapterCount: 7 },
  { id: "m4", name: "The Hollow Compendium", author: "Anonymous", status: "ongoing", genres: ["Dark Fantasy / Grimdark"], tags: ["villain-protagonist", "necromancy"], contentWarnings: ["traumatising-content", "sexual-content"], avgRating: 4.8, reviewCount: 31, chapterCount: 12, synopsis: "The cataloguer of a dying empire keeps appending the dead." },
  { id: "m5", name: "Lantern & Ledger", author: "Mira Souza", status: "completed", genres: ["Cozy Fantasy"], tags: ["multiple-leads", "redemption-arc"], contentWarnings: ["ai-imagery"], avgRating: 4.9, reviewCount: 3, chapterCount: 1, synopsis: "A guild accountant adopts a haunted lantern." },
  { id: "m6", name: "Rivers of Elsewhere", author: "Ito Ren", status: "ongoing", genres: ["Portal Fantasy"], tags: ["female-lead", "faith-and-gods"], contentWarnings: ["profanity"], avgRating: 3.9, reviewCount: 21, chapterCount: 58, releaseSchedule: "Twice a month" },
];
