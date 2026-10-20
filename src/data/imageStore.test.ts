import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  allImageBlobs, blobToDataUrl, dataUrlToBlob, deleteImageBlob,
  imageBlob, imagesPending, onImageWriteFailure, putImageBlob,
} from "./imageStore";

const PNG_A = "data:image/png;base64,AAA";
const PNG_B = "data:image/png;base64,BBBBBBBBBB";

/** base64 round-trip may re-encode with canonical padding; compare decoded bytes. */
const bytesOf = (dataUrl: string): Uint8Array => {
  const binary = atob(dataUrl.split(",", 2)[1] ?? "");
  return new Uint8Array(binary.split("").map((c) => c.charCodeAt(0)));
};

function freshIdb(): void {
  globalThis.indexedDB = new IDBFactory();
}

beforeEach(freshIdb);

describe("imageStore blob persistence", () => {
  it("stores a dataURL blob and reads the same bytes back", async () => {
    await putImageBlob("img_1", await dataUrlToBlob(PNG_A));
    const blob = await imageBlob("img_1");
    expect(blob).toBeTruthy();
    expect(bytesOf(await blobToDataUrl(blob!))).toEqual(bytesOf(PNG_A));
    expect((await blobToDataUrl(blob!)).startsWith("data:image/png;base64,")).toBe(true);
  });

  it("overwrites an existing key with the latest payload", async () => {
    await putImageBlob("img_1", await dataUrlToBlob(PNG_A));
    await putImageBlob("img_1", await dataUrlToBlob(PNG_B));
    expect(bytesOf(await blobToDataUrl((await imageBlob("img_1"))!)))
      .toEqual(bytesOf(PNG_B));
  });

  it("deletes a key and tolerates repeated deletes", async () => {
    await putImageBlob("img_1", await dataUrlToBlob(PNG_A));
    await deleteImageBlob("img_1");
    expect(await imageBlob("img_1")).toBeUndefined();
    await expect(deleteImageBlob("img_1")).resolves.toBeUndefined();
  });

  it("allImageBlobs lists every key and clears after deletes", async () => {
    await putImageBlob("img_1", await dataUrlToBlob(PNG_A));
    await putImageBlob("img_2", await dataUrlToBlob(PNG_B));
    const all = await allImageBlobs();
    expect([...all.keys()].sort()).toEqual(["img_1", "img_2"]);
    await deleteImageBlob("img_2");
    expect([...(await allImageBlobs()).keys()]).toEqual(["img_1"]);
  });

  it("tracks the pending write per key until it lands", async () => {
    const write = putImageBlob("img_1", await dataUrlToBlob(PNG_A));
    await Promise.resolve(); // let putImageBlob register the pending entry
    expect(imagesPending("img_1")).toBeTruthy();
    await write;
    expect(imagesPending("img_1")).toBeUndefined();
  });

  it("reports write failures through onImageWriteFailure once per failure", async () => {
    const failures: Array<{ key: string; message: string }> = [];
    const stop = onImageWriteFailure((key, error) => failures.push({ key, message: String((error as Error).message) }));
    freshIdb();
    globalThis.indexedDB = { open: () => { throw new Error("boom"); } } as unknown as IDBFactory;
    await expect(putImageBlob("img_bad", await dataUrlToBlob(PNG_A))).rejects.toThrow("boom");
    expect(failures).toEqual([{ key: "img_bad", message: "boom" }]);
    stop();
  });

  it("reopening against a different factory reads its own island", async () => {
    await putImageBlob("img_1", await dataUrlToBlob(PNG_A));
    const before = await allImageBlobs();
    expect(before.size).toBe(1);
    freshIdb();
    expect((await allImageBlobs()).size).toBe(0);
    vi.restoreAllMocks();
  });
});
