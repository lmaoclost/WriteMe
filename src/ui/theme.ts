import { useSyncExternalStore } from "react";

/** Day/night theme. Follows the i18n language pattern: own localStorage key,
 *  no store slice — the preference is UI chrome, not world data. */
export type Theme = "night" | "day";

export const THEME_STORAGE_KEY = "writeme.theme";
const DEFAULT_THEME: Theme = "night";

/** The class on <html> driving the light token block in theme.css. */
const LIGHT_CLASS = "light";

/** Anything but "day" (null, junk) resets to the night default. */
export function normalizeTheme(value: unknown): Theme {
  return value === "day" ? "day" : DEFAULT_THEME;
}

export function readStoredTheme(): Theme {
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function otherTheme(theme: Theme): Theme {
  return theme === "day" ? "night" : "day";
}

function writeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(LIGHT_CLASS, theme === "day");
}

function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable: theme still applies for this session */
  }
}

let current: Theme = DEFAULT_THEME;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  current = readStoredTheme();
  writeClass(current);
}

export function setTheme(theme: Theme): void {
  current = normalizeTheme(theme);
  persistTheme(current);
  writeClass(current);
  for (const listener of listeners) listener();
}

/** Single source of truth for both mounts (rail footer + library header). */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => current,
    () => DEFAULT_THEME,
  );
  return { theme, toggleTheme: () => setTheme(otherTheme(theme)) };
}
