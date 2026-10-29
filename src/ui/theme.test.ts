import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, otherTheme, readStoredTheme, useTheme, type Theme } from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("defaults to night with nothing stored", () => {
    expect(readStoredTheme()).toBe<Theme>("night");
  });

  it("reads a stored day theme and rejects junk", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "day");
    expect(readStoredTheme()).toBe("day");
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readStoredTheme()).toBe("night");
  });

  it("otherTheme always flips the toggle", () => {
    expect(otherTheme("night")).toBe("day");
    expect(otherTheme("day")).toBe("night");
  });

  it("toggling re-renders, persists, and flips the html light class", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("night");
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe("day");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("day");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe("night");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("night");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("booting with a stored day theme applies the light class", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "day");
    document.documentElement.className = "";
    vi.resetModules();
    await import("./theme");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("survives storage failure and still switches for the session", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => useTheme());
    expect(() => act(() => { result.current.toggleTheme(); })).not.toThrow();
    expect(result.current.theme).toBe("day");
    spy.mockRestore();
  });
});
