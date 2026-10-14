import type { PinType } from "../../../domain/types";

export const PIN_TYPE_META: Record<PinType, { icon: string; label: string }> = {
  place: { icon: "⚑", label: "Lugar" },
  person: { icon: "○", label: "Pessoa" },
  event: { icon: "✦", label: "Evento" },
  item: { icon: "◆", label: "Item" },
};
