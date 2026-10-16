import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ChroniclesPage } from "./ChroniclesPage";
import { tagLabelOf, warningLabelOf } from "./catalog";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/chronicles"]}>
      <ChroniclesPage />
    </MemoryRouter>,
  );
}

describe("ChroniclesPage", () => {
  it("renders brand, search, filter chips and status chips", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Chronicles" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Search stories, authors, synopses...")).toBeTruthy();
    for (const l of ["All", "Ongoing", "Completed", "Hiatus"]) {
      expect(screen.getByRole("button", { name: l })).toBeTruthy();
    }
    expect(screen.getAllByRole("button", { name: "All genres" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "All tags" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Profanity")).toBeTruthy();
    expect(screen.getByText("Gore")).toBeTruthy();
    expect(screen.getByText("Sexual Content")).toBeTruthy();
    expect(screen.getByText("Traumatising Content")).toBeTruthy();
    expect(screen.getByText("AI-Generated Cover")).toBeTruthy();
  });

  it("shows all 6 sample cards with chapters pluralization", () => {
    renderPage();
    expect(screen.getAllByRole("article").length).toBe(6);
    expect(screen.getByText("The Amber Seal")).toBeTruthy();
    expect(screen.getByText("41 chapters")).toBeTruthy();
    expect(screen.getByText("1 chapter")).toBeTruthy();
  });

  it("status filter narrows to completed", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Completed" }));
    expect(screen.getAllByRole("article").length).toBe(2);
    expect(screen.queryByText("The Amber Seal")).toBeNull();
  });

  it("search filters by title and author", () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText("Search stories, authors, synopses..."), {
      target: { value: "ito ren" },
    });
    expect(screen.getAllByRole("article").length).toBe(2);
    expect(screen.queryByText("The Amber Seal")).toBeNull();
  });

  it("genre dropdown selects and shows count badge, clears", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "All genres" })[0]);
    fireEvent.click(screen.getByText("Cozy Fantasy", { selector: ".genres-menu-item-label" }));
    expect(screen.getByText("Cozy Fantasy", { selector: ".genres-trigger-label" })).toBeTruthy();
    expect(document.querySelector(".genres-count-badge")?.textContent).toBe("1");
    expect(screen.getByText("Clear (1)")).toBeTruthy();
    expect(screen.queryByText("The Amber Seal")).toBeNull();
  });

  it("warnings can be excluded via chips", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Sexual Content" }));
    expect(screen.queryByText("The Hollow Compendium")).toBeNull();
    expect(screen.queryByTitle("Click to show stories with Sexual Content")).toBeTruthy();
  });

  it("rating row and synopsis render", () => {
    renderPage();
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("(12)")).toBeTruthy();
    expect(screen.getByText("A guild accountant adopts a haunted lantern.")).toBeTruthy();
  });

  it("status pills use exact labels", () => {
    renderPage();
    const pills = document.querySelectorAll(".manuscript-status-pill");
    expect(pills).toHaveLength(6);
    expect(document.querySelectorAll(".manuscript-status-pill.status-ongoing")).toHaveLength(3);
    expect(document.querySelectorAll(".manuscript-status-pill.status-completed")).toHaveLength(2);
    expect(document.querySelectorAll(".manuscript-status-pill.status-hiatus")).toHaveLength(1);
  });

  it("catalog helpers map ids exact", () => {
    expect(tagLabelOf("morally-grey-lead")).toBe("Morally Grey Lead");
    expect(warningLabelOf("ai-imagery")).toBe("AI-Generated Cover");
  });
});
