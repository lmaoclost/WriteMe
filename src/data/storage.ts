import type { PersistStorage } from "zustand/middleware";
import { validateProjectData } from "./schema";
import type { ProjectData } from "../domain/types";

const PREFIX = "scriptorium";
export const STORE_KEY = `${PREFIX}.v1`;

const WRITE_DEBOUNCE_MS = 800;

interface PendingWrite {
  serialized: string;
  timer: number;
}
/** key → payload queued for a coalesced write; cleared by flush, timer, or rehydration. */
const pendingWrites = new Map<string, PendingWrite>();

function writeThrough(name: string, serialized: string): void {
  try {
    localStorage.setItem(name, serialized);
  } catch {
    /* quota: toast surface happens in actions */
  }
}

/** Write queued payloads now — used by upload verification and pagehide. */
export function flushPendingPersist(): void {
  for (const [name, pending] of pendingWrites) {
    window.clearTimeout(pending.timer);
    writeThrough(name, pending.serialized);
  }
  pendingWrites.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingPersist);
}

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
    // rehydration supersedes anything still queued for this key
    const pending = pendingWrites.get(name);
    if (pending) {
      window.clearTimeout(pending.timer);
      pendingWrites.delete(name);
    }
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
    const serialized = JSON.stringify(value);
    const prev = pendingWrites.get(name);
    if (prev) window.clearTimeout(prev.timer);
    pendingWrites.set(name, {
      serialized,
      timer: window.setTimeout(() => {
        pendingWrites.delete(name);
        writeThrough(name, serialized);
      }, WRITE_DEBOUNCE_MS),
    });
  },
  removeItem: (name) => {
    const pending = pendingWrites.get(name);
    if (pending) {
      window.clearTimeout(pending.timer);
      pendingWrites.delete(name);
    }
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
