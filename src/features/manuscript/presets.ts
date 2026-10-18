import type { BinderPreset, BinderyConfig } from "../../domain/types";

/** Preset patch: scalar fields as-is, nested blocks partial (merged field-by-field). */
type Patch = Partial<{ [K in keyof BinderyConfig]: Partial<NonNullable<BinderyConfig[K]>> | BinderyConfig[K] }>;

export const PRESETS: { id: BinderPreset; label: string; patch: Patch }[] = [
  { id: "manuscript", label: "Manuscript", patch: {
    font: '"Times New Roman", Times, serif', dropCaps: false, runningHead: true, runningHeadMode: "book",
    typography: { bodyPt: 12, leading: 18, indent: 0, justify: false, hyphens: false },
    geometry: { mirrored: false, gutter: 0.5 },
    opener: { sink: 0, suppressHead: false, suppressFolio: false },
    frontMatter: { halfTitle: false, copyright: false, romanNumerals: false },
    sceneOrnament: "blank",
  } },
  { id: "classic", label: "Literary classic", patch: {
    font: '"EB Garamond", Garamond, "Book Antiqua", serif', dropCaps: true, runningHead: true, runningHeadMode: "chapter",
    typography: { bodyPt: 11, leading: 14.5, indent: 1, justify: true, hyphens: false },
    geometry: { mirrored: true, gutter: "auto" },
    opener: { sink: 0.18, suppressHead: true, suppressFolio: true },
    frontMatter: { halfTitle: true, copyright: true, romanNumerals: true },
    sceneOrnament: "asterism",
  } },
  { id: "commercial", label: "Modern commercial", patch: {
    font: "Literata, Georgia, serif", dropCaps: false, runningHead: true, runningHeadMode: "chapter",
    typography: { bodyPt: 11, leading: 14.5, indent: 1, justify: false, hyphens: false },
    geometry: { mirrored: true, gutter: "auto" },
    opener: { sink: 0.14, suppressHead: true, suppressFolio: true },
    frontMatter: { halfTitle: true, copyright: true, romanNumerals: true },
    sceneOrnament: "blank",
  } },
  { id: "fantasy", label: "Ornamented fantasy", patch: {
    font: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif', dropCaps: true, runningHead: true, runningHeadMode: "chapter",
    typography: { bodyPt: 11, leading: 15, indent: 1, justify: true, hyphens: false },
    geometry: { mirrored: true, gutter: "auto" },
    opener: { sink: 0.22, suppressHead: true, suppressFolio: true },
    frontMatter: { halfTitle: true, copyright: true, romanNumerals: true },
    sceneOrnament: "fleuron",
  } },
];

const NESTED_BLOCKS = ["typography", "geometry", "opener", "frontMatter"] as const;

/** Apply a preset: replace its declared scalar fields, merge its declared
 *  nested blocks over the config, leave everything else untouched. */
export function applyPreset(config: BinderyConfig, id: BinderPreset): BinderyConfig {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) return config;
  const next = { ...config, ...preset.patch, preset: id } as BinderyConfig;
  for (const key of NESTED_BLOCKS) {
    const base = config[key];
    const patch = preset.patch[key];
    if (base && patch) (next as Record<string, unknown>)[key] = { ...base, ...patch };
  }
  return next;
}
