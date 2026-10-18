import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPendingPersist, localStoragePersistence, STORE_KEY } from "./storage";
import type { PersistedState } from "./storage";

type Doc = { state: PersistedState & { marker: string }; version: number };

const docWith = (marker: string): Doc => ({
  state: { projects: [], entries: [], atlases: [], manuscripts: [], images: {}, bloodlines: [], seedFlag: false, marker } as PersistedState & { marker: string },
  version: 2,
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
