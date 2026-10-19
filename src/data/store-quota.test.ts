import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScriptorium } from "./store";
import { flushPendingPersist, localStoragePersistence, STORE_KEY } from "./storage";
import type { PersistedState } from "./storage";

const QUOTA_MSG = "Could not save — browser storage is full. Download a backup copy.";
const ACTION_LABEL = "Download backup";

type Doc = { state: PersistedState & { marker: string }; version: number };

const docWith = (marker: string): Doc =>
  ({ state: { projects: [], entries: [], atlases: [], manuscripts: [], images: {}, bloodlines: [], seedFlag: false, marker }, version: 2 });

let storagePoisoned = false;
function poisonQuota(): void {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
    if (k === STORE_KEY) throw new DOMException("quota exceeded", "QuotaExceededError");
    Storage.prototype.setItem.call(this, k, v);
  });
  storagePoisoned = true;
}

function unpoison(): void {
  vi.mocked(Storage.prototype.setItem).mockRestore();
  storagePoisoned = false;
}

const quotaToasts = () => useScriptorium.getState().toasts.filter((t) => t.message === QUOTA_MSG);

describe("persist quota toast wiring", () => {
  beforeEach(() => {
    useScriptorium.setState(useScriptorium.getInitialState());
    flushPendingPersist(); // drain the scheduled reset write with healthy storage
    localStorage.clear();
  });

  afterEach(() => {
    if (storagePoisoned) unpoison();
  });

  it("pushes one error toast on the first persist failure, not one per edit", () => {
    poisonQuota();
    localStoragePersistence.setItem(STORE_KEY, docWith("f1"));
    flushPendingPersist();
    const found = quotaToasts();
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("error");
    expect(found[0].action?.label).toBe(ACTION_LABEL);

    localStoragePersistence.setItem(STORE_KEY, docWith("f2"));
    flushPendingPersist();
    expect(quotaToasts()).toHaveLength(1);
  });

  it("dismisses the toast when a write lands again", () => {
    poisonQuota();
    localStoragePersistence.setItem(STORE_KEY, docWith("fail"));
    flushPendingPersist();
    expect(quotaToasts()).toHaveLength(1);
    unpoison();
    localStoragePersistence.setItem(STORE_KEY, docWith("ok"));
    flushPendingPersist();
    expect(quotaToasts()).toHaveLength(0);
  });

  it("does not resurrect a manually dismissed toast on recovery", () => {
    poisonQuota();
    localStoragePersistence.setItem(STORE_KEY, docWith("fail"));
    flushPendingPersist();
    const [toast] = quotaToasts();
    useScriptorium.getState().dismissToast(toast.id);
    unpoison();
    localStoragePersistence.setItem(STORE_KEY, docWith("ok"));
    flushPendingPersist();
    expect(quotaToasts()).toHaveLength(0);
  });

  it("toast action downloads the backup JSON", () => {
    const stub = (name: string, impl: unknown) => {
      Object.defineProperty(URL, name, { value: impl, writable: true, configurable: true });
    };
    stub("createObjectURL", () => "blob:mock");
    stub("revokeObjectURL", () => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(this: HTMLAnchorElement) {});

    poisonQuota();
    localStoragePersistence.setItem(STORE_KEY, docWith("fail"));
    flushPendingPersist();
    const [toast] = quotaToasts();
    toast.action!.run();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.getAttribute("download")).toMatch(/^scriptorium-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(anchor.getAttribute("href")).toBe("blob:mock");

    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
    vi.restoreAllMocks();
    storagePoisoned = false;
  });
});
