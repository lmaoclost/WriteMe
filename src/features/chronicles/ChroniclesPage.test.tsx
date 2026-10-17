import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ChroniclesPage } from "./ChroniclesPage";
import { AppRouter } from "../../app/router";
import { useAccount } from "../../data/account";
import { useScriptorium } from "../../data/store";
import { beforeEach } from "vitest";
import { tagLabelOf, warningLabelOf } from "./catalog";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/chronicles"]}>
      <ChroniclesPage />
    </MemoryRouter>,
  );
}

function at(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>
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
    expect(document.querySelector(".chronicles-grid")).toBeTruthy();
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

describe("Chronicles Archivist", () => {
  beforeEach(() => {
    localStorage.clear();
    useAccount.setState(useAccount.getInitialState());
    useScriptorium.setState(useScriptorium.getInitialState());
  });

  it("hero shows wax seal + wordmark lockup", () => {
    render(at("/chronicles"));
    expect(document.querySelector(".library-hero .seal")).toBeTruthy();
    expect(document.querySelector(".library-hero .library-brand-logo")?.textContent).toBe("Chronicles");
  });

  it("user cluster appears when a username exists and links to the profile", () => {
    useAccount.setState({ username: "renan", avatarUrl: "data:image/png;base64,AV" });
    render(at("/chronicles"));
    const cluster = screen.getByRole("link", { name: /renan/i });
    expect(cluster.getAttribute("href")).toBe("/profile");
    expect(cluster.querySelector("img")).toBeTruthy();
  });

  it("no cluster without a username", () => {
    render(at("/chronicles"));
    expect(screen.queryByRole("link", { name: /renan/i })).toBeNull();
  });

  it("filter row has small-caps group labels STATUS, GENRES, TAGS", () => {
    render(at("/chronicles"));
    expect(screen.getByText("STATUS")).toBeInTheDocument();
    expect(screen.getByText("GENRES")).toBeInTheDocument();
    expect(screen.getByText("TAGS")).toBeInTheDocument();
  });

  it("warning toggle says HIDE WARNINGS uppercase", () => {
    render(at("/chronicles"));
    expect(screen.getByRole("button", { name: "HIDE WARNINGS" })).toBeInTheDocument();
  });

  it("search input has a leading magnifier", () => {
    render(at("/chronicles"));
    const box = screen.getByPlaceholderText("Search stories, authors, synopses...");
    expect(box.parentElement!.querySelector(".search-icon")).toBeTruthy();
  });
});

describe("chronicles dropdowns a11y", () => {
  it("closes the genres menu on Escape and restores focus to the trigger", () => {
    renderPage();
    const trigger = screen.getAllByRole("button", { name: /All genres/i })[0];
    fireEvent.click(trigger);
    expect(document.querySelector(".genres-menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".genres-menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes an open menu when clicking outside", () => {
    renderPage();
    const trigger = screen.getAllByRole("button", { name: /All genres/i })[0];
    fireEvent.click(trigger);
    expect(document.querySelector(".genres-menu")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    expect(document.querySelector(".genres-menu")).toBeNull();
  });
});
