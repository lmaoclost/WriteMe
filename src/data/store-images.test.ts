import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { act } from "@testing-library/react";
import { STORE_KEY } from "./storage";
// top-level imageStore instance: seeding helpers for the TEST side only.
// The store module re-imports a fresh instance inside bootStore; they share
// the same globalThis.indexedDB factory below, so IDs are reachable both ways.
import { dataUrlToBlob, blobToDataUrl, putImageBlob } from "./imageStore";

const PNG_A = "data:image/png;base64,AAA";
const PNG_B = "data:image/png;base64,BBBBBBBB";

const bytesOf = (dataUrl: string): Uint8Array => {
  const binary = atob(dataUrl.split(",", 2)[1] ?? "");
  return new Uint8Array(binary.split("").map((c) => c.charCodeAt(0)));
};

/** Fresh store module per test: boot IIFE, subscriber snapshot and persist state
 *  are all one-shot, so resetModules + a fresh IDB factory rebuild the island.
 *  Helpers come from the POST-reset imageStore — the same instance the store uses. */
async function bootStore(): Promise<{ store: typeof import("./store")["useScriptorium"]; images: typeof import("./imageStore") }> {
  vi.resetModules();
  const [mod, images] = await Promise.all([import("./store"), import("./imageStore")]);
  await vi.waitFor(() => expect(mod.useScriptorium.getState().imagesReady).toBe(true));
  return { store: mod.useScriptorium, images };
}

function brokenFactory(): void {
  globalThis.indexedDB = { open: () => { throw new Error("boom"); } } as unknown as IDBFactory;
}

const docOf = (state: Record<string, unknown>): string => JSON.stringify({ state, version: 1 });

const emptyData = (): Record<string, unknown> => ({
  projects: [], entries: [], atlases: [], manuscripts: [], images: {}, bloodlines: [],
});

const persistedImagesCount = (): number => {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return 0;
  const doc = JSON.parse(raw) as { state?: { images?: Record<string, string> } };
  return Object.keys(doc.state?.images ?? {}).length;
};

beforeEach(() => {
  localStorage.clear();
  globalThis.indexedDB = new IDBFactory();
});

describe("image persistence via IndexedDB", () => {
  it("migrates legacy localStorage images into IndexedDB and strips the doc", async () => {
    localStorage.setItem(STORE_KEY, docOf({ ...emptyData(), images: { imgA: PNG_A } }));
    const { store, images } = await bootStore();
    expect(store.getState().imagesReady).toBe(true);
    expect(bytesOf(store.getState().images.imgA!)).toEqual(bytesOf(PNG_A));
    expect(persistedImagesCount()).toBe(0);
    expect([...(await images.allImageBlobs()).keys()]).toContain("imgA");
  });

  it("restores images from IndexedDB on the next boot without a legacy doc", async () => {
    await putImageBlob("imgX", await dataUrlToBlob(PNG_A)); // seed BEFORE the boot reads the island
    const { store } = await bootStore();
    expect(bytesOf(store.getState().images.imgX!)).toEqual(bytesOf(PNG_A));
    expect(persistedImagesCount()).toBe(0);
  });

  it("putImage lands the blob in IndexedDB and never in the persisted doc", async () => {
    const { store, images } = await bootStore();
    const key = store.getState().putImage(PNG_A, "entry");
    await images.imagesPending(key);
    expect([...(await images.allImageBlobs()).keys()]).toContain(key);
    expect(persistedImagesCount()).toBe(0);
    expect(bytesOf(store.getState().images[key])).toEqual(bytesOf(PNG_A));
  });

  it("putMapImage keeps the image in memory when the durable write fails, with an error toast", async () => {
    const { store, images } = await bootStore();
    const atlas = store.getState().addAtlas(store.getState().addProject("W").id, "Map");
    brokenFactory();
    let ok = true;
    act(() => { ok = store.getState().putMapImage(atlas.id, PNG_A); });
    expect(ok).toBe(true);
    await vi.waitFor(() =>
      expect(store.getState().toasts.some((t) => t.kind === "error" && t.message.includes("image"))).toBe(true),
    );
    expect(store.getState().atlases.find((a) => a.id === atlas.id)!.mapImageKey).toBeTruthy();
    expect((await images.allImageBlobs()).size).toBe(0);
  });

  it("putMapImage stores the blob and frees the previous key on success", async () => {
    const { store, images } = await bootStore();
    const atlas = store.getState().addAtlas(store.getState().addProject("W").id, "Map");
    let ok1 = false;
    let ok2 = false;
    act(() => {
      ok1 = store.getState().putMapImage(atlas.id, PNG_A);
      ok2 = store.getState().putMapImage(atlas.id, PNG_B);
    });
    expect(ok1).toBe(true);
    expect(ok2).toBe(true);
    const atlasState = store.getState().atlases.find((a) => a.id === atlas.id)!;
    const second = atlasState.mapImageKey!;
    const first = Object.keys(store.getState().images).find((k) => k.startsWith("img_map_") && k !== second)!;
    expect(bytesOf(store.getState().images[second])).toEqual(bytesOf(PNG_B));
    await vi.waitFor(async () => {
      const all = await images.allImageBlobs();
      expect([...all.keys()].sort()).toEqual([second]);
      expect(all.has(first)).toBe(false);
    });
    expect(bytesOf(await blobToDataUrl((await images.imageBlob(second))!))).toEqual(bytesOf(PNG_B));
    await images.deleteImageBlob(second); // island hygiene: do not leak into later tests
  });

  it("removeImage clears the durable blob through the subscriber", async () => {
    const { store, images } = await bootStore();
    const key = store.getState().putImage(PNG_A, "entry");
    await images.imagesPending(key);
    store.getState().removeImage(key);
    await vi.waitFor(async () => expect((await images.allImageBlobs()).has(key)).toBe(false));
  });

  it("resetAll empties the durable island too", async () => {
    const { store, images } = await bootStore();
    const key = store.getState().putImage(PNG_A, "entry");
    await images.imagesPending(key);
    store.getState().resetAll();
    await vi.waitFor(async () => expect((await images.allImageBlobs()).size).toBe(0));
  });

  it("exportData still carries the image dataURLs after migration", async () => {
    localStorage.setItem(STORE_KEY, docOf({ ...emptyData(), images: { imgA: PNG_A } }));
    const { store, images } = await bootStore();
    // the migration lands before asserting anything about exports
    await vi.waitFor(async () => expect(await images.imageBlob("imgA")).toBeTruthy(), { timeout: 10000 });
    const payload = JSON.parse(store.getState().exportData()) as { images: Record<string, string> };
    expect(bytesOf(payload.images.imgA)).toEqual(bytesOf(PNG_A));
  });

  it("importData syncs the durable island: new keys land, dropped keys are deleted", async () => {
    const { store, images } = await bootStore();
    const staleKey = store.getState().putImage(PNG_A, "entry");
    await images.imagesPending(staleKey);
    const backup = JSON.stringify({
      app: "writeme", version: 1,
      ...emptyData(),
      images: { imgN: PNG_B },
    });
    const result = store.getState().importData(backup);
    expect(result.ok).toBe(true);
    await vi.waitFor(async () => {
      const keys = [...(await images.allImageBlobs()).keys()];
      expect(keys).toContain("imgN");
      expect(keys).not.toContain(staleKey);
    });
    expect(bytesOf(store.getState().images.imgN!)).toEqual(bytesOf(PNG_B));
    await images.deleteImageBlob("imgN");
  });

  it("surfaces a toast when a durable image write fails outside putMapImage", async () => {
    const { store } = await bootStore();
    brokenFactory();
    store.getState().putImage(PNG_A, "entry");
    await vi.waitFor(() =>
      expect(store.getState().toasts.some((t) => t.kind === "error" && t.message.includes("image"))).toBe(true),
    );
  });
});
