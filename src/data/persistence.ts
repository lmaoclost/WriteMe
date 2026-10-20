export const PERSIST_FLAG = "scriptorium.persistRequested";

/** Ask the browser to keep this origin's storage out of eviction.
 *  Chromium grants silently; Firefox may prompt; Safari accepts the call but
 *  usually denies it. One attempt per profile: a denied prompt must not nag.
 *  Never throws — boot keeps working when storage is disabled. */
export async function requestPersistentStorage(): Promise<boolean> {
  const manager = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (!manager || typeof manager.persist !== "function") return false;
  try {
    if (typeof manager.persisted === "function" && await manager.persisted()) return true;
    if (typeof localStorage === "undefined" || localStorage.getItem(PERSIST_FLAG)) return false;
    localStorage.setItem(PERSIST_FLAG, "1");
    return await manager.persist();
  } catch {
    return false;
  }
}
