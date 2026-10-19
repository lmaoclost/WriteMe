import type { ConnectionType } from "../../domain/types";

export interface ConnectionStyle { label: string; labelKey: string; color: string; dashArray: string }

// Relationship types: Ally/Rival/Vassal/Trade/Neutral with their colors.
export const FACTION_CONNECTION_STYLES = {
  ally: { label: "Ally", labelKey: "factions.connection.ally", color: "#27ae60", dashArray: "" },
  rival: { label: "Rival", labelKey: "factions.connection.rival", color: "#e74c3c", dashArray: "8 4" },
  vassal: { label: "Vassal", labelKey: "factions.connection.vassal", color: "#7c5cbf", dashArray: "" },
  trade: { label: "Trade", labelKey: "factions.connection.trade", color: "#d4a017", dashArray: "8 4" },
  neutral: { label: "Neutral", labelKey: "factions.connection.neutral", color: "#888888", dashArray: "4 4" },
} as const satisfies Record<ConnectionType, ConnectionStyle>;

export const FACTION_PRESET_COLORS = [
  "#c0392b", "#e74c3c", "#e67e22", "#f1c40f", "#27ae60", "#2ecc71",
  "#2980b9", "#3498db", "#7c5cbf", "#8e44ad", "#2c3e50", "#34495e", "#7a7a99",
];
