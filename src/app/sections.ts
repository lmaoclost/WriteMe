import {
  Book, BookOpen, Calendar, Feather, Hourglass, Languages, LayoutGrid,
  Lightbulb, Map, Network, Orbit, Shield, Users, type LucideIcon,
} from "lucide-react";

export const GROUPS = [
  { key: "reference", labelKey: "sections.groups.reference" },
  { key: "relations", labelKey: "sections.groups.relations" },
  { key: "worldbuilding", labelKey: "sections.groups.worldbuilding" },
  { key: "writing", labelKey: "sections.groups.writing" },
] as const;

export type GroupKey = (typeof GROUPS)[number]["key"];

export interface SectionDef {
  key: string;
  labelKey: string;
  to: string;
  icon: LucideIcon;
  groupKey: GroupKey | "";
  tipKey: string;
}

export const SECTIONS = [
  { key: "overview", labelKey: "sections.overview.label", to: "", icon: BookOpen, groupKey: "", tipKey: "sections.overview.tip" },
  { key: "atlas", labelKey: "sections.atlas.label", to: "atlas", icon: Map, groupKey: "reference", tipKey: "sections.atlas.tip" },
  { key: "entries", labelKey: "sections.lore.label", to: "entries", icon: Book, groupKey: "reference", tipKey: "sections.lore.tip" },
  { key: "timeline", labelKey: "sections.chronology.label", to: "timeline", icon: Hourglass, groupKey: "reference", tipKey: "sections.chronology.tip" },
  { key: "bloodline", labelKey: "sections.bloodline.label", to: "bloodline", icon: Users, groupKey: "relations", tipKey: "sections.bloodline.tip" },
  { key: "factions", labelKey: "sections.factions.label", to: "factions", icon: Network, groupKey: "relations", tipKey: "sections.factions.tip" },
  { key: "oaths", labelKey: "sections.oaths.label", to: "oaths", icon: Shield, groupKey: "relations", tipKey: "sections.oaths.tip" },
  { key: "calendar", labelKey: "sections.calendar.label", to: "calendar", icon: Calendar, groupKey: "worldbuilding", tipKey: "sections.calendar.tip" },
  { key: "plotboard", labelKey: "sections.plotboard.label", to: "plotboard", icon: LayoutGrid, groupKey: "worldbuilding", tipKey: "sections.plotboard.tip" },
  { key: "linewheel", labelKey: "sections.timeline.label", to: "linewheel", icon: Orbit, groupKey: "worldbuilding", tipKey: "sections.timeline.tip" },
  { key: "wellspring", labelKey: "sections.wellspring.label", to: "wellspring", icon: Lightbulb, groupKey: "writing", tipKey: "sections.wellspring.tip" },
  { key: "conlang", labelKey: "sections.conlang.label", to: "conlang", icon: Languages, groupKey: "writing", tipKey: "sections.conlang.tip" },
  { key: "manuscript", labelKey: "sections.manuscript.label", to: "manuscript", icon: Feather, groupKey: "writing", tipKey: "sections.manuscript.tip" },
  { key: "bindery", labelKey: "sections.bindery.label", to: "bindery", icon: BookOpen, groupKey: "writing", tipKey: "sections.bindery.tip" },
] as const;
