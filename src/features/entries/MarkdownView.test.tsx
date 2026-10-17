import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useScriptorium } from "../../data/store";
import { MarkdownView } from "./MarkdownView";
import { act } from "@testing-library/react";
import type { WorldEntry } from "../../domain/types";

const store = () => useScriptorium.getState();

function seedEntries() {
  useScriptorium.setState(useScriptorium.getInitialState());
  localStorage.clear();
  act(() => { store().addProject("V"); });
  const prj = store().projects[0].id;
  act(() => {
    store().updateEntry(store().addEntry(prj, "faction").id, { title: "Casa Vellmor", body: "Dinastia do rio." });
  });
  return prj;
}

describe("MarkdownView with wiki links", () => {
  it("resolvable [[Title]] renders an anchor with the entry id", () => {
    seedEntries();
    render(<MarkdownView body="A [[Casa Vellmor]] governa o rio." />);
    const link = screen.getByText("Casa Vellmor", { selector: "a.wiki-link" });
    expect(link).toHaveAttribute("data-entry-link", store().entries[0].id);
  });

  it("hover shows a preview card with category + blurb", () => {
    seedEntries();
    const prj = store().projects[0].id;
    act(() => { store().updateEntry(store().entries[0].id, { summary: "Dinastia, rio, três pontes." } as Partial<WorldEntry>); });
    void prj;
    render(<MarkdownView body="A [[Casa Vellmor]] governa." />);
    const link = screen.getByText("Casa Vellmor", { selector: "a.wiki-link" });
    const el = link as HTMLElement;
    // jsdom has no layout; just fire pointerover with coordinates
    fireEvent(el, new MouseEvent("pointerover", { bubbles: true }));
    const card = screen.getByTestId("wiki-preview");
    expect(card.textContent).toContain("Casa Vellmor");
    expect(card.textContent).toContain("Dinastia, rio, três pontes.");
  });

  it("clicking a wiki link navigates to the codex with the entry selected", () => {
    seedEntries();
    const picked: string[] = [];
    render(<MarkdownView body="A [[Casa Vellmor]] governa." onSelectEntry={(id) => picked.push(id)} />);
    fireEvent.click(screen.getByText("Casa Vellmor", { selector: "a.wiki-link" }));
    expect(picked).toEqual([store().entries[0].id]);
  });
});
