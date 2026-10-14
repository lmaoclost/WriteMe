export interface ConnectionStyle { label: string; color: string; dashArray: string }

// legacy relationship types: Ally/Rival/Vassal/Trade/Neutral with the bundle colors.
export const FACTION_CONNECTION_STYLES: Record<string, ConnectionStyle> = {
  ally: { label: "Aliada", color: "#27ae60", dashArray: "" },
  rival: { label: "Rival", color: "#e74c3c", dashArray: "8 4" },
  vassal: { label: "Vassala", color: "#7c5cbf", dashArray: "" },
  trade: { label: "Comércio", color: "#d4a017", dashArray: "8 4" },
  neutral: { label: "Neutra", color: "#888888", dashArray: "4 4" },
};

export const FACTION_PRESET_COLORS = [
  "#c0392b", "#e74c3c", "#e67e22", "#f1c40f", "#27ae60", "#2ecc71",
  "#2980b9", "#3498db", "#7c5cbf", "#8e44ad", "#2c3e50", "#34495e",
];
