import { useEffect, useState } from "react";

/** Recent colors are an ephemeral, module-scope singleton: not persisted, not
 *  in the persisted store — they reset when the page reloads. Max 6 entries,
 *  deduped case-insensitively, most recent first. */
const MAX_RECENT_COLORS = 6;
let recentColors: string[] = [];
/** F6/spec §2: the most recently picked color feeds addRegion's default
 *  (lastColor|#3498db). Same ephemerality as the recents: module singleton. */
let lastColor: string | null = null;
const listeners = new Set<() => void>();

export function getRecentColors(): string[] {
  return recentColors;
}

export function getLastRegionColor(): string | null {
  return lastColor;
}

export function setLastRegionColor(color: string): void {
  lastColor = color;
}

export function pushRecentColor(color: string): void {
  lastColor = color;
  const next = [color, ...recentColors.filter((c) => c.toLowerCase() !== color.toLowerCase())]
    .slice(0, MAX_RECENT_COLORS);
  if (next.length === recentColors.length && next.every((c, i) => c === recentColors[i])) return;
  recentColors = next;
  for (const listener of listeners) listener();
}

export function resetRecentColors(): void {
  recentColors = [];
  lastColor = null;
  for (const listener of listeners) listener();
}

export function subscribeRecentColors(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRecentColors(): string[] {
  const [colors, setColors] = useState<string[]>(recentColors);
  useEffect(() => subscribeRecentColors(() => setColors([...recentColors])), []);
  return colors;
}
