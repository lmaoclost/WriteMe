import { afterEach, describe, expect, it } from "vitest";
import { isChromiumEngine } from "./engine";

afterEach(() => {
  delete (navigator as { userAgentData?: unknown }).userAgentData;
});

describe("isChromiumEngine", () => {
  it("detects Chromium through userAgentData", () => {
    Object.defineProperty(navigator, "userAgentData", { configurable: true, value: {} });
    expect(isChromiumEngine()).toBe(true);
  });

  it("treats Firefox and WebKit as non-Chromium", () => {
    expect(isChromiumEngine()).toBe(false);
  });
});
