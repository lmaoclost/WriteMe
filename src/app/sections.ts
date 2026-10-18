import {
  Book, BookOpen, Calendar, Feather, Hourglass, Languages, LayoutGrid,
  Lightbulb, Map, Network, Orbit, Shield, Users, type LucideIcon,
} from "lucide-react";

export interface SectionDef {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  group: string;
  tip: string;
}

export const SECTIONS: SectionDef[] = [
  { key: "overview", label: "Overview", to: "", icon: BookOpen, group: "", tip: "The world's home" },
  { key: "atlas", label: "Atlas", to: "atlas", icon: Map, group: "Reference", tip: "Map regions and drop pins for places" },
  { key: "entries", label: "Lore", to: "entries", icon: Book, group: "Reference", tip: "Characters, places, creatures and things" },
  { key: "timeline", label: "Chronology", to: "timeline", icon: Hourglass, group: "Reference", tip: "Dated events in world order" },
  { key: "bloodline", label: "Bloodline", to: "bloodline", icon: Users, group: "Relations", tip: "Family trees across generations" },
  { key: "factions", label: "Factions", to: "factions", icon: Network, group: "Relations", tip: "Who fights whom, who backs whom" },
  { key: "oaths", label: "Oaths", to: "oaths", icon: Shield, group: "Relations", tip: "Chains of loyalty between groups" },
  { key: "calendar", label: "Calendar", to: "calendar", icon: Calendar, group: "Worldbuilding", tip: "Your world's own year and months" },
  { key: "plotboard", label: "Plot board", to: "plotboard", icon: LayoutGrid, group: "Worldbuilding", tip: "Story arcs as cards on a board" },
  { key: "linewheel", label: "Timeline", to: "linewheel", icon: Orbit, group: "Worldbuilding", tip: "Beads strung on a wheel" },
  { key: "wellspring", label: "Ideas", to: "wellspring", icon: Lightbulb, group: "Writing", tip: "Loose ideas, before they have a home" },
  { key: "conlang", label: "Language", to: "conlang", icon: Languages, group: "Writing", tip: "Words and phonetics for your tongue" },
  { key: "manuscript", label: "Manuscript", to: "manuscript", icon: Feather, group: "Writing", tip: "Write the chapters" },
  { key: "bindery", label: "Publishing", to: "bindery", icon: BookOpen, group: "Writing", tip: "Trim the manuscript for export" },
];

export const GROUPS = ["Reference", "Relations", "Worldbuilding", "Writing"] as const;