import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRouter } from "../app/router";
import { useScriptorium } from "../data/store";
import type { Manuscript } from "../domain/types";

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

function workspaceAt() {
  const p = useScriptorium.getState().addProject("Shimradis");
  useScriptorium.setState((s) => ({
    entries: [
      ...(s.entries ?? []),
      { id: "ent-1", projectId: p.id, title: "King Aldric", category: "person", body: "", links: [] },
      { id: "ent-2", projectId: p.id, title: "The Ember Gate", category: "place", body: "", links: [] },
    ] as never[],
  }));
  const manuscript: Manuscript = {
    id: "man-test", projectId: p.id, title: "Cantar de Vellmora", author: "R",
    chapters: [{ id: "ch-1", heading: "The Long Winter", content: "", order: 0 }],
  };
  useScriptorium.setState((s) => ({ manuscripts: [...(s.manuscripts ?? []), manuscript] as never[] }));
  render(
    <MemoryRouter initialEntries={[`/p/${p.id}`]}>
      <AppRouter />
    </MemoryRouter>,
  );
  return p;
}

describe("command palette", () => {
  it("opens with ctrl+K and lists sections, entries and chapters", () => {
    workspaceAt();
    act(() => { fireEvent.keyDown(window, { key: "k", ctrlKey: true }); });
    const dialog = screen.getByRole("dialog");
    const q = within(dialog).getByPlaceholderText(/jump to/i) as HTMLInputElement;
    expect(q).toBeInTheDocument();
    expect(within(dialog).getByText("Atlas")).toBeInTheDocument();
    expect(within(dialog).getByText("King Aldric")).toBeInTheDocument();
    expect(within(dialog).getByText("The Long Winter")).toBeInTheDocument();
  });

  it("filters results by query", () => {
    workspaceAt();
    act(() => { fireEvent.keyDown(window, { key: "k", ctrlKey: true }); });
    const dialog = screen.getByRole("dialog");
    const q = within(dialog).getByPlaceholderText(/jump to/i) as HTMLInputElement;
    act(() => { fireEvent.change(q, { target: { value: "ember" } }); });
    expect(within(dialog).getByText("The Ember Gate")).toBeInTheDocument();
    expect(within(dialog).queryByText("King Aldric")).toBeNull();
    expect(within(dialog).queryByText("The Long Winter")).toBeNull();
  });

  it("enter navigates to the selected result and closes", () => {
    workspaceAt();
    act(() => { fireEvent.keyDown(window, { key: "k", ctrlKey: true }); });
    const dialog = screen.getByRole("dialog");
    const q = within(dialog).getByPlaceholderText(/jump to/i) as HTMLInputElement;
    act(() => { fireEvent.change(q, { target: { value: "king" } }); });
    act(() => { fireEvent.keyDown(q, { key: "Enter" }); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByDisplayValue("King Aldric")).toBeInTheDocument();
  });

  it("esc closes without navigating", () => {
    workspaceAt();
    act(() => { fireEvent.keyDown(window, { key: "k", ctrlKey: true }); });
    const dialog = screen.getByRole("dialog");
    const q = within(dialog).getByPlaceholderText(/jump to/i) as HTMLInputElement;
    fireEvent.keyDown(q, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByDisplayValue("King Aldric")).toBeNull();
  });

  it("palette listbox is ARIA-correct and scrollable to the active option", () => {
    workspaceAt();
    act(() => { fireEvent.keyDown(window, { key: "k", ctrlKey: true }); });
    const dialog = screen.getByRole("dialog");
    const input = within(dialog).getByPlaceholderText(/jump to/i) as HTMLInputElement;
    expect(input).toHaveAttribute("aria-controls", "palette-list");
    expect(input).toHaveAttribute("aria-activedescendant");
    const directOption = dialog.querySelectorAll('[role="listbox"] > [role="option"]');
    expect(directOption.length).toBeGreaterThan(0);
    expect(directOption[0].getAttribute("aria-selected")).toBe("true");
  });

  it("rail search affordance opens the palette", () => {
    workspaceAt();
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
