import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { UpdatesPage, SAMPLE_UPDATES } from "./UpdatesPage";
import { AppRouter } from "../../app/router";

function at(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <UpdatesPage />
    </MemoryRouter>
  );
}

describe("UpdatesPage", () => {
  it("shows header, subtitle and back-to-feed link", () => {
    render(at("/updates"));
    expect(screen.getByRole("heading", { level: 2, name: "Updates" })).toBeTruthy();
    expect(screen.getByText("News, changes, and what we're forging next")).toBeTruthy();
    const back = screen.getByRole("link", { name: "Feed" });
    expect(back.getAttribute("href")).toBe("/");
  });

  it("renders the real changelog as a hairline ledger", () => {
    render(at("/updates"));
    const ledger = screen.getByRole("region", { name: "Release ledger" });
    expect(within(ledger).getAllByRole("article")).toHaveLength(SAMPLE_UPDATES.length);
    for (const row of within(ledger).getAllByRole("article")) {
      expect(row.className).toContain("border-t");
    }
    expect(within(ledger).getAllByText("by Scriptorium")).toHaveLength(SAMPLE_UPDATES.length);
    expect(within(ledger).getAllByText("Read more →")).toHaveLength(SAMPLE_UPDATES.length);
    // real release, legacy sample gone
    expect(screen.queryByText("Scriptorium Update — A NEW HOMEPAGE")).toBeNull();
    expect(screen.getByText("Public profiles")).toBeTruthy();
    expect(screen.getByText("Settings backups")).toBeTruthy();
    expect(screen.getByText("The hub")).toBeTruthy();
  });

  it("formats dates as uppercase long months, EN", () => {
    render(at("/updates"));
    const dates = screen.getAllByLabelText(/release date/i);
    expect(dates.length).toBe(SAMPLE_UPDATES.length);
    expect(dates[0].textContent).toMatch(/^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER) \d{1,2}, \d{4}$/u);
  });

  it("newest release comes first", () => {
    render(at("/updates"));
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
    expect(titles.indexOf("Public profiles")).toBe(0);
    expect(titles.lastIndexOf("Visual pass")).toBe(titles.length - 1);
  });


  it("route /updates renders through AppRouter", () => {
    render(
      <MemoryRouter initialEntries={["/updates"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Updates" })).toBeTruthy();
  });
});
