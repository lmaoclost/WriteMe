/** Image persistence in IndexedDB: Blob values keyed by imageKey.
 *  The zustand store keeps dataURLs in memory; this module is the durable copy.
 *  The database promise caches per IDBFactory instance so tests can swap in a
 *  fresh fake-indexeddb factory and start an empty island. */

const DB_NAME = "writeme.images";
const DB_VERSION = 1;
const STORE_NAME = "images";

type ImageWriteFailure = (key: string, error: unknown) => void;
const writeFailureListeners = new Set<ImageWriteFailure>();

/** Subscribe to failed durable writes (quota, corruption). Deletions that fail
 *  are NOT reported: a stale orphan blob is harmless. */
export function onImageWriteFailure(listener: ImageWriteFailure): () => void {
  writeFailureListeners.add(listener);
  return () => writeFailureListeners.delete(listener);
}

const openDatabases = new WeakMap<IDBFactory, Promise<IDBDatabase>>();

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  const cached = openDatabases.get(factory);
  if (cached) return cached;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
  });
  // a rejected open must not poison the cache: the next call retries
  opening.catch(() => openDatabases.delete(factory));
  openDatabases.set(factory, opening);
  return opening;
}

function db(): Promise<IDBDatabase> {
  const factory = globalThis.indexedDB as IDBFactory;
  return openDb(factory);
}

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB request failed"));
  });
}

function factoryIsUsable(factory: unknown): factory is IDBFactory {
  return !!factory && typeof (factory as IDBFactory).open === "function";
}

/** The in-flight durable write per key, so actions can await verification. */
/** Per-key operation chains: put/delete order per key is causal, so a delete
 *  queued after a put cannot be resurrected by the in-flight write landing later. */
const keyChains = new Map<string, Promise<unknown>>();

function chain<T>(key: string, op: () => Promise<T>, afterError?: (error: unknown) => void): Promise<T> {
  const prev = keyChains.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(op);
  keyChains.set(key, next.catch(() => {}));
  if (afterError) next.catch(afterError);
  return next;
}

const pendingWrites = new Map<string, Promise<void>>();

export function imagesPending(key: string): Promise<void> | undefined {
  return pendingWrites.get(key);
}

async function runPut(key: string, payload: ArrayBufferRecord): Promise<void> {
  if (!factoryIsUsable(globalThis.indexedDB)) throw new Error("indexedDB unavailable");
  const database = await db();
  const store = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
  await awaitRequest(store.put(payload, key));
}

type ArrayBufferRecord = { bytes: Uint8Array<ArrayBuffer>; type: string };

function base64ToBytes(payload: string): Uint8Array<ArrayBuffer> {
  const binary = atob(payload);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Derive the durable record without relying on Blob#arrayBuffer (missing on
 *  some realm-polyfilled Blobs): FileReader → dataURL → atob when needed. */
async function toRecord(blob: Blob): Promise<ArrayBufferRecord> {
  const type = blob.type || "application/octet-stream";
  if (typeof blob.arrayBuffer === "function") {
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type };
  }
  const dataUrl = await blobToDataUrl(blob);
  return { bytes: base64ToBytes((dataUrl.split(",", 2)[1] ?? "")), type };
}

/** Values are plain {bytes, type} records, not Blobs: fake-indexeddb clones
 *  Blobs through its own polyfill (no arrayBuffer) and jsdom's FileReader
 *  rejects foreign-realm instances. ArrayBuffer clones cleanly everywhere.
 *  `source` accepts a Blob or a base64 dataURL string; either way the pending
 *  entry registers synchronously so verifiers can await it right after a set. */
export function putImageBlob(key: string, source: Blob | string): Promise<void> {
  const write = chain(
    key,
    async () => {
      const blob = typeof source === "string" ? await dataUrlToBlob(source) : source;
      await runPut(key, await toRecord(blob));
    },
    (error) => {
      if (writeFailureListeners.size) {
        for (const listener of [...writeFailureListeners]) listener(key, error);
      }
    },
  )
    .catch((error) => { throw error; })
    .finally(() => pendingWrites.delete(key));
  pendingWrites.set(key, write);
  return write;
}

export async function deleteImageBlob(key: string): Promise<void> {
  if (!factoryIsUsable(globalThis.indexedDB)) return;
  await chain(key, async () => {
    const database = await db();
    const store = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
    await awaitRequest(store.delete(key));
  }).catch(() => { /* a stale orphan blob is harmless; reads treat a miss as absent */ });
}

export async function imageBlob(key: string): Promise<Blob | undefined> {
  const record = await imageRecord(key);
  if (!record) return undefined;
  return new Blob([record.bytes], { type: record.type });
}

async function imageRecord(key: string): Promise<ArrayBufferRecord | undefined> {
  if (!factoryIsUsable(globalThis.indexedDB)) return undefined;
  try {
    const database = await db();
    const store = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
    return await awaitRequest(store.get(key) as IDBRequest<ArrayBufferRecord | undefined>);
  } catch {
    return undefined; // reads degrade to "image unavailable" (placeholder flows)
  }
}

export async function allImageBlobs(): Promise<Map<string, Blob>> {
  if (!factoryIsUsable(globalThis.indexedDB)) return new Map();
  try {
    const database = await db();
    const store = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
    const keys = await awaitRequest(store.getAllKeys() as IDBRequest<IDBValidKey[]>);
    const records = await Promise.all(keys.map((key) => imageRecord(String(key))));
    const all = new Map<string, Blob>();
    keys.forEach((key, i) => {
      const record = records[i];
      if (record) all.set(String(key), new Blob([record.bytes], { type: record.type }));
    });
    return all;
  } catch {
    return new Map();
  }
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (match && match[2]) {
    const mime = match[1] || "application/octet-stream";
    const bytes = base64ToBytes(match[3] ?? "");
    return new Blob([bytes], { type: mime });
  }
  // non-base64 data URLs (URL-encoded payloads) are theoretical; the app
  // only ever produces base64 data URLs, so fetch is the graceful fallback.
  const response = await fetch(dataUrl);
  return response.blob();
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}
