import { render, screen } from "@testing-library/react";
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

  it("renders the static update cards with title, date and Read more", () => {
    render(at("/updates"));
    expect(screen.getAllByRole("article")).toHaveLength(SAMPLE_UPDATES.length);
    const cards = screen.getAllByRole("article");
    for (const card of cards) {
      expect(card.className).toBe("update-card");
    }
    expect(screen.getAllByText("by Scriptorium")).toHaveLength(SAMPLE_UPDATES.length);
    expect(screen.getAllByText("Read more →")).toHaveLength(SAMPLE_UPDATES.length);
    expect(screen.getByText("Scriptorium Update — A NEW HOMEPAGE")).toBeTruthy();
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
