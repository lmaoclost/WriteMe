import type { PinType } from "../../../domain/types";

export const PIN_TYPE_META = {
  place: { icon: "⚑", labelKey: "atlas.pin.types.place" },
  person: { icon: "○", labelKey: "atlas.pin.types.person" },
  event: { icon: "✦", labelKey: "atlas.pin.types.event" },
  item: { icon: "◆", labelKey: "atlas.pin.types.item" },
} as const satisfies Record<PinType, { icon: string; labelKey: string }>;
