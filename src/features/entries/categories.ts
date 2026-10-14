import type { EntryCategory } from "../../domain/types";

export const CATEGORY_COLORS: Record<EntryCategory, string> = {
  person: "#e74c3c",
  place: "#4d6f8f",
  faction: "#c9a227",
  event: "#a64b35",
  item: "#8f7fd0",
  lore: "#4d8f5f",
};

export const CATEGORY_LABELS: Record<EntryCategory, string> = {
  person: "Pessoas",
  place: "Lugares",
  faction: "Fações",
  event: "Eventos",
  item: "Itens",
  lore: "Lore",
};
