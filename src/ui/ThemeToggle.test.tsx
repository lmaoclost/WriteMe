import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";
import { THEME_STORAGE_KEY } from "./theme";

describe("ThemeToggle", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("offers the day mode while night is active", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to day mode" })).toBeTruthy();
  });

  it("switches to day, persists it and flips the html light class", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to day mode" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("day");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(screen.getByRole("button", { name: "Switch to night mode" })).toBeTruthy();
  });

  it("toggles back to night", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "day");
    document.documentElement.classList.add("light");
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to night mode" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("night");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});
