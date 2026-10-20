import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, downloadUrl } from "./download";

interface Seen {
  download: string;
  href: string;
  connected: boolean;
}

let seen: Seen | null = null;
let click: ReturnType<typeof vi.spyOn>;
let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  seen = null;
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    seen = { download: this.download, href: this.href, connected: document.body.contains(this) };
  });
  revoke = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:mock"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revoke,
  });
});

afterEach(() => {
  vi.useRealTimers();
  click.mockRestore();
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
});

describe("downloadUrl", () => {
  it("clicks an anchor that is in the document, then removes it", () => {
    downloadUrl("data:image/svg+xml;utf8,%3Csvg/%3E", "sheet.svg");

    expect(seen).toEqual({
      download: "sheet.svg",
      href: "data:image/svg+xml;utf8,%3Csvg/%3E",
      connected: true,
    });
    expect(document.querySelector("a[download='sheet.svg']")).toBeNull();
  });

  it("leaves data URLs alive (nothing to revoke)", () => {
    downloadUrl("data:image/svg+xml;utf8,%3Csvg/%3E", "sheet.svg");
    vi.advanceTimersByTime(60_000);
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe("downloadBlob", () => {
  it("revokes the object URL only after the click has started the download", () => {
    downloadBlob(new Blob(["x"], { type: "application/json" }), "backup.json");

    expect(seen).toEqual({ download: "backup.json", href: "blob:mock", connected: true });
    expect(revoke).not.toHaveBeenCalled();

    vi.advanceTimersByTime(40_000);
    expect(revoke).toHaveBeenCalledWith("blob:mock");
  });
});
