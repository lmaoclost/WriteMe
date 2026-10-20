import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERSIST_FLAG, requestPersistentStorage } from "./persistence";

type StorageStub = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

function stubStorage(value: StorageStub): void {
  Object.defineProperty(navigator, "storage", { configurable: true, value });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete (navigator as { storage?: unknown }).storage;
  localStorage.clear();
});

describe("requestPersistentStorage", () => {
  it("does nothing when the browser has no StorageManager", async () => {
    stubStorage({});
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it("does not ask again when the origin is already persistent", async () => {
    const persist = vi.fn(async () => false);
    stubStorage({ persisted: async () => true, persist });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it("asks once and remembers the attempt", async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persisted: async () => false, persist });

    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PERSIST_FLAG)).toBe("1");

    await expect(requestPersistentStorage()).resolves.toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("survives a rejected persist() without breaking boot", async () => {
    stubStorage({
      persisted: async () => false,
      persist: async () => { throw new Error("permission denied"); },
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
    expect(localStorage.getItem(PERSIST_FLAG)).toBe("1");
  });
});
