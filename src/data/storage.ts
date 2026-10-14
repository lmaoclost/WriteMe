import type { PersistStorage } from "zustand/middleware";
import { validateProjectData } from "./schema";
import type { ProjectData } from "../domain/types";

const PREFIX = "scriptorium";
export const STORE_KEY = `${PREFIX}.v1`;

export function corruptBackupKey(): string {
  return `${PREFIX}.corrupt.${new Date().toISOString()}`;
}

export function backupCorruptRaw(raw: string): boolean {
  try {
    localStorage.setItem(corruptBackupKey(), raw);
    return true;
  } catch {
    return false;
  }
}

export type PersistedState = ProjectData & { seedFlag: boolean };

interface PersistedDoc {
  state?: unknown;
  version?: unknown;
}

export const localStoragePersistence: PersistStorage<PersistedState> = {
  getItem: (name) => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(name);
    } catch {
      return null;
    }
    if (raw == null) return null;
    let doc: PersistedDoc;
    try {
      doc = JSON.parse(raw) as PersistedDoc;
    } catch {
      backupCorruptRaw(raw);
      return null;
    }
    if (!doc || typeof doc !== "object" || doc.state === undefined) return null;
    if (!validateProjectData(doc.state)) {
      backupCorruptRaw(raw);
      return null;
    }
    return {
      state: doc.state as PersistedState,
      version: typeof doc.version === "number" ? doc.version : 1,
    };
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch {
      /* quota: toast surface happens in actions */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export function wipeStore(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

export function storageHealth(): { corruptBackups: number; bytes: number } {
  let corruptBackups = 0;
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${PREFIX}.corrupt.`)) corruptBackups++;
      if (k?.startsWith(PREFIX)) bytes += (localStorage.getItem(k) ?? "").length;
    }
  } catch {
    /* ignore */
  }
  return { corruptBackups, bytes };
}
