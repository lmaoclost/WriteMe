import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPendingPersist, localStoragePersistence, onPersistQuotaChange, STORE_KEY } from "./storage";
import type { PersistedState } from "./storage";

type Doc = { state: PersistedState & { marker: string }; version: number };

const docWith = (marker: string): Doc => ({
  state: { projects: [], entries: [], atlases: [], manuscripts: [], images: {}, bloodlines: [], seedFlag: false, marker } as PersistedState & { marker: string },
  version: 1,
});

beforeEach(() => {
  vi.useFakeTimers();
  flushPendingPersist();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("localStoragePersistence debounced writes", () => {
  it("defers the raw write past the debounce window", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("first"));
    expect(localStorage.getItem(STORE_KEY)).toBeNull();
    vi.advanceTimersByTime(1500);
    const doc = JSON.parse(localStorage.getItem(STORE_KEY)!) as Doc;
    expect(doc.state.marker).toBe("first");
  });

  it("writes only the latest payload when several arrive inside the window", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("v1"));
    localStoragePersistence.setItem(STORE_KEY, docWith("v2"));
    localStoragePersistence.setItem(STORE_KEY, docWith("v3"));
    vi.advanceTimersByTime(1500);
    const serialized = localStorage.getItem(STORE_KEY)!;
    expect((JSON.parse(serialized) as Doc).state.marker).toBe("v3");
  });

  it("flushPendingPersist writes through immediately", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("now"));
    flushPendingPersist();
    const doc = JSON.parse(localStorage.getItem(STORE_KEY)!) as Doc;
    expect(doc.state.marker).toBe("now");
  });

  it("pagehide flushes pending writes without waiting for the timer", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("closing"));
    window.dispatchEvent(new Event("pagehide"));
    const doc = JSON.parse(localStorage.getItem(STORE_KEY)!) as Doc;
    expect(doc.state.marker).toBe("closing");
  });

  it("rehydration (getItem) supersedes a pending write", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("stale"));
    localStoragePersistence.getItem(STORE_KEY);
    vi.advanceTimersByTime(1500);
    expect(localStorage.getItem(STORE_KEY)).toBeNull();
  });
});

/** Replace the STORE_KEY write with a quota failure; other keys keep working. */
let storagePoisoned = false;
function poisonQuota(): void {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
    if (k === STORE_KEY) throw new DOMException("quota exceeded", "QuotaExceededError");
    Storage.prototype.setItem.call(this, k, v);
  });
  storagePoisoned = true;
}

function poisonGeneric(): void {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
    if (k === STORE_KEY) throw new Error("storage unavailable");
    Storage.prototype.setItem.call(this, k, v);
  });
  storagePoisoned = true;
}

function unpoison(): void {
  vi.mocked(Storage.prototype.setItem).mockRestore();
  storagePoisoned = false;
}

describe("persist quota signalling", () => {
  afterEach(() => {
    if (storagePoisoned) unpoison();
  });

  it("signals failure once on quota error and recovery once when a write lands", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("reset"));
    vi.advanceTimersByTime(1500);
    const events: boolean[] = [];
    const stop = onPersistQuotaChange((failed) => events.push(failed));
    poisonQuota();
    localStoragePersistence.setItem(STORE_KEY, docWith("boom"));
    vi.advanceTimersByTime(1500);
    expect(events).toEqual([true]);
    unpoison();
    localStoragePersistence.setItem(STORE_KEY, docWith("back"));
    vi.advanceTimersByTime(1500);
    expect(events).toEqual([true, false]);
    stop();
  });

  it("deduplicates repeated failures while the quota stays exceeded", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("reset"));
    vi.advanceTimersByTime(1500);
    const events: boolean[] = [];
    const stop = onPersistQuotaChange((failed) => events.push(failed));
    poisonQuota();
    localStoragePersistence.setItem(STORE_KEY, docWith("f1"));
    vi.advanceTimersByTime(1500);
    localStoragePersistence.setItem(STORE_KEY, docWith("f2"));
    vi.advanceTimersByTime(1500);
    expect(events).toEqual([true]);
    stop();
  });

  it("signals on flushPendingPersist, not only on the timer path", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("reset"));
    flushPendingPersist();
    const events: boolean[] = [];
    const stop = onPersistQuotaChange((failed) => events.push(failed));
    poisonQuota();
    localStoragePersistence.setItem(STORE_KEY, docWith("flushfail"));
    flushPendingPersist();
    expect(events).toEqual([true]);
    unpoison();
    stop();
  });

  it("ignores non-quota write errors", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("reset"));
    vi.advanceTimersByTime(1500);
    const events: boolean[] = [];
    const stop = onPersistQuotaChange((failed) => events.push(failed));
    poisonGeneric();
    localStoragePersistence.setItem(STORE_KEY, docWith("generic"));
    vi.advanceTimersByTime(1500);
    expect(events).toEqual([]);
    unpoison();
    stop();
  });

  it("stops signalling after unsubscribe", () => {
    localStoragePersistence.setItem(STORE_KEY, docWith("reset"));
    vi.advanceTimersByTime(1500);
    const events: boolean[] = [];
    const stop = onPersistQuotaChange((failed) => events.push(failed));
    stop();
    poisonQuota();
    localStoragePersistence.setItem(STORE_KEY, docWith("quiet"));
    vi.advanceTimersByTime(1500);
    expect(events).toEqual([]);
    unpoison();
  });
});
