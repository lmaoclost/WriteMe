import type { EntryCategory } from "../../domain/types";
import { i18n, normalizeLanguage } from "../../i18n";
import en from "../../i18n/locales/en.json";
import ptBR from "../../i18n/locales/pt-BR.json";

/** EN is the resource shape; PT mirrors it. */
type TemplateLexicon = typeof en.categories;
const SECTION_KEYS: Record<string, keyof TemplateLexicon["sections"]> = {
  "Quick Facts": "quickFacts",
  "Overview": "overview",
  "Detail": "detail",
};
function lexicon(): TemplateLexicon {
  return normalizeLanguage(i18n.language) === "pt-BR" ? ptBR.categories : en.categories;
}

export interface CodexCategoryDef {
  key: EntryCategory;
  label: string;
  icon: string;
  tagline: string;
  sections: { name: string; fields: string[] }[];
}

/** Section templates from the Codex editor field map. */
export const CODEX_CATEGORIES: readonly CodexCategoryDef[] = [
  {
    key: "nation", label: "Nations & Empires", icon: "🏰", tagline: "An empire that shaped the world",
    sections: [
      { name: "Quick Facts", fields: ["Name", "Government", "Capital"] },
      { name: "Overview", fields: ["Etymology", "History", "Dynasty"] },
      { name: "Detail", fields: ["Territories", "Government", "Military", "Religion & Culture", "Foreign Relations", "Economy", "Current State"] },
    ],
  },
  {
    key: "character", label: "Characters", icon: "👤", tagline: "A soul worth remembering",
    sections: [
      { name: "Quick Facts", fields: ["Identity", "Titles", "Appearance", "Personality", "Voice", "Goals & Motivations"] },
      { name: "Detail", fields: ["Abilities", "Affiliations", "Relationships", "Equipment", "Backstory"] },
    ],
  },
  {
    key: "creature", label: "Bestiary", icon: "🐾", tagline: "A beast that stalks the wilds",
    sections: [
      { name: "Quick Facts", fields: ["Identity", "Danger Level"] },
      { name: "Detail", fields: ["Appearance", "Habitat", "Behavior", "Cultural Significance"] },
    ],
  },
  {
    key: "location", label: "Locations", icon: "🗺", tagline: "A place of legend or ruin",
    sections: [
      { name: "Quick Facts", fields: ["Name", "Climate"] },
      { name: "Detail", fields: ["Description", "History", "Notable Residents", "Climate", "Points of Interest"] },
    ],
  },
  {
    key: "flora", label: "Flora", icon: "🌿", tagline: "Life that takes root and endures",
    sections: [
      { name: "Quick Facts", fields: ["Identity"] },
      { name: "Detail", fields: ["Appearance", "Properties", "Uses", "Regions Found"] },
    ],
  },
  {
    key: "material", label: "Materials & Elements", icon: "💎", tagline: "The substance of creation",
    sections: [
      { name: "Quick Facts", fields: ["Identity"] },
      { name: "Detail", fields: ["Properties", "Interactions", "Applications", "Discovery"] },
    ],
  },
  {
    key: "technology", label: "Technology", icon: "⚙", tagline: "Inventions that shape the age",
    sections: [
      { name: "Quick Facts", fields: ["Identity"] },
      { name: "Detail", fields: ["Overview", "Mechanism", "Origin", "Materials", "Limitations", "Variants"] },
    ],
  },
  {
    key: "magic", label: "Magic & Powers", icon: "✨", tagline: "Forces beyond mortal reach",
    sections: [
      { name: "Quick Facts", fields: ["Name", "Source"] },
      { name: "Detail", fields: ["Rules", "Cost & Limitations", "Tiers & Variants"] },
    ],
  },
  {
    key: "culture", label: "Cultures", icon: "🎭", tagline: "The ways of a people",
    sections: [
      { name: "Quick Facts", fields: ["Identity"] },
      { name: "Detail", fields: ["Customs", "Religion", "Social Hierarchy", "Dress", "Cuisine"] },
    ],
  },
  {
    key: "artifact", label: "Artifacts", icon: "🗡", tagline: "An object of power and history",
    sections: [
      { name: "Quick Facts", fields: ["Name", "Current Location"] },
      { name: "Detail", fields: ["Description", "History", "Powers", "Current Location", "Lineage of Ownership"] },
    ],
  },
  {
    key: "language", label: "Languages", icon: "📜", tagline: "Words that bind a civilization",
    sections: [
      { name: "Quick Facts", fields: ["Identity"] },
      { name: "Detail", fields: ["Phoneme Rules", "Naming Conventions", "Common Phrases", "Script"] },
    ],
  },
  {
    key: "event", label: "Events & History", icon: "📅", tagline: "A moment that changed everything",
    sections: [
      { name: "Quick Facts", fields: ["Name", "When"] },
      { name: "Detail", fields: ["What Happened", "Causes", "Consequences", "Key Figures"] },
    ],
  },
  {
    key: "faction", label: "Factions & Organizations", icon: "⚔", tagline: "Bound by oath or ambition",
    sections: [
      { name: "Quick Facts", fields: ["Name", "Purpose"] },
      { name: "Detail", fields: ["Purpose", "Leadership", "Members", "Rivals", "Territory"] },
    ],
  },
  {
    key: "deity", label: "Deities & Divines", icon: "☄", tagline: "Powers that shaped the heavens",
    sections: [
      { name: "Quick Facts", fields: ["Name", "Domain"] },
      { name: "Detail", fields: ["Domain", "Worship", "Mythology", "Symbols", "Relationships"] },
    ],
  },
  {
    key: "lore", label: "General Lore", icon: "📖", tagline: "Everything else worth knowing",
    sections: [
      { name: "Detail", fields: ["Description", "Details"] },
    ],
  },
] as const;

/** Legacy v1 keys still accepted in data (seed/compat), mapped for display. */
export const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  person: "Characters",
  place: "Locations",
  item: "Artifacts",
  lore: "General Lore",
};

export function categoryDef(key: string): CodexCategoryDef | undefined {
  return CODEX_CATEGORIES.find((c) => c.key === key);
}

/** Display def for ANY category key, including user-defined kinds. */
export function kindDef(key: string, customs?: { key: string; label: string; icon: string; color?: string }[]): { label: string; icon: string; color: string } {
  const custom = customs?.find((k) => k.key === key);
  if (custom) return { label: custom.label, icon: custom.icon, color: custom.color ?? "#e0c264" };
  const def = categoryDef(key);
  if (def) return { label: categoryLabel(key), icon: def.icon, color: CATEGORY_COLORS[key] ?? "#e0c264" };
  const legacy = lexicon().legacy[key as keyof TemplateLexicon["legacy"]];
  if (legacy) return { label: legacy, icon: "📖", color: CATEGORY_COLORS[key] ?? "#e0c264" };
  return { label: key, icon: "📜", color: "#e0c264" };
}

/** Dot color that falls back to gold for user-defined kinds. */
export function categoryDot(key: string, customs?: { key: string; label: string; icon: string; color?: string }[]): string {
  return kindDef(key, customs).color;
}

export function categoryLabel(key: string): string {
  const lex = lexicon();
  const def = categoryDef(key);
  if (def) return (lex.labels as Record<string, string>)[def.key];
  return lex.legacy[key as keyof TemplateLexicon["legacy"]] ?? lex.labels.lore;
}

export function categoryIcon(key: string): string {
  return categoryDef(key)?.icon ?? "📖";
}

/** Sections a fresh entry of this category starts with (labels pre-created in
 *  the active UI language; they become user data once written). */
export function templateSections(key: string): { name: string; fields: { label: string; content: string }[] }[] {
  const def = categoryDef(key);
  if (!def) return [];
  const lex = lexicon();
  const fields = lex.fields as Record<string, string>;
  return def.sections.map((s) => ({
    name: lex.sections[SECTION_KEYS[s.name] ?? "detail"],
    fields: s.fields.map((label) => ({ label: fields[label] ?? label, content: "" })),
  }));
}
/** Category dot colors (v1 palette, extended for the 15 forge categories). */
export const CATEGORY_COLORS: Record<string, string> = {
  nation: "#2c3e50",
  character: "#e74c3c",
  creature: "#7c5cbf",
  location: "#4d6f8f",
  flora: "#2ecc71",
  material: "#8f7fd0",
  technology: "#3498db",
  magic: "#9b59b6",
  culture: "#e67e22",
  artifact: "#d4a017",
  language: "#f1c40f",
  event: "#a64b35",
  faction: "#c9a227",
  deity: "#1abc9c",
  lore: "#4d8f5f",
  // legacy v1
  person: "#e74c3c",
  place: "#4d6f8f",
  item: "#d4a017",
};

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CODEX_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<string, string>;

export interface Chip { value: EntryCategory | null; label: string; icon?: string }

/** Legacy v1 keys → canonical forge key (only 3 collide). */
export const CATEGORY_CANONICAL: Record<string, EntryCategory> = {
  person: "character", place: "location", item: "artifact",
};

export function codexCategoryChips(): readonly Chip[] {
  const lex = lexicon();
  return [
    { value: null, label: lex.all, icon: "✦" },
    ...CODEX_CATEGORIES.map((c) => ({ value: c.key as EntryCategory, label: (lex.labels as Record<string, string>)[c.key], icon: c.icon })),
  ];
}
