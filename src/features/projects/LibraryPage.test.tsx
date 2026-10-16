import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useScriptorium } from "../../data/store";
import { LibraryPage } from "./LibraryPage";

function wrap() {
  return (
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>
  );
}

const FORGE_NAMES = [
  "Codex", "Atlas", "Calendar", "Plot board",
  "Bloodline", "Manuscript", "Bindery Scriptorium",
];

beforeEach(() => {
  useScriptorium.setState(useScriptorium.getInitialState());
  localStorage.clear();
});

describe("LibraryPage hub", () => {
  it("shows welcome, forges and my-worlds section even with zero worlds", () => {
    render(wrap());
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    FORGE_NAMES.forEach((f) => expect(screen.getByText(f)).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "My worlds" })).toBeInTheDocument();
  });

  it("ghost forge cards are not links while there is no world", () => {
    render(wrap());
    expect(screen.getByText(/Create a world to enable the forges/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Codex/i })).toBeNull();
  });

  it("load demo from empty state populates a full world and hides afterward", async () => {
    render(wrap());
    const btn = screen.getByRole("button", { name: /load the sample project/i });
    fireEvent.click(btn);
    await waitFor(() => expect(useScriptorium.getState().seedFlag).toBe(true));
    expect(useScriptorium.getState().projects).toHaveLength(1);
    expect(useScriptorium.getState().entries.length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByRole("button", { name: /load the sample project/i })).toBeNull();
  });

  it("single world is auto-selected and the selector is hidden", () => {
    const p = useScriptorium.getState().addProject("Solo");
    render(wrap());
    expect(screen.queryByLabelText(/active world/i)).toBeNull();
    const tome = screen.getByRole("link", { name: /Codex/i });
    expect(tome).toHaveAttribute("href", `/p/${p.id}/entries`);
  });

  it("selector appears with two+ worlds and directs forges at the chosen world", () => {
    useScriptorium.getState().addProject("Aurora");
    const b = useScriptorium.getState().addProject("Borealis");
    render(wrap());
    const sel = screen.getByLabelText(/active world/i);
    expect((sel as HTMLSelectElement).value).toBe(b.id); // most recently created
    fireEvent.change(sel, { target: { value: useScriptorium.getState().projects[1].id } });
    const tome = screen.getByRole("link", { name: /Codex/i });
    expect(tome.getAttribute("href")).toBe(`/p/${useScriptorium.getState().projects[1].id}/entries`);
  });

  it("Bloodline card exposes both bloodline and oaths links", () => {
    const p = useScriptorium.getState().addProject("Solo");
    render(wrap());
    expect(screen.getByRole("link", { name: /Bloodline/i })).toHaveAttribute("href", `/p/${p.id}/bloodline`);
    expect(screen.getByRole("link", { name: /Oaths/i })).toHaveAttribute("href", `/p/${p.id}/oaths`);
  });

  it("creates a world through the modal in EN", async () => {
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: /new world/i }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Shimradis" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(useScriptorium.getState().projects.map((p) => p.name)).toEqual(["Shimradis"]));
    expect(useScriptorium.getState().toasts.some((t) => t.message === "World created.")).toBe(true);
  });

  it("deletes with EN confirmation modal", async () => {
    act(() => { useScriptorium.getState().addProject("Old"); });
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: "Delete world" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(useScriptorium.getState().projects).toHaveLength(0));
    expect(useScriptorium.getState().toasts.some((t) => t.message === "World deleted.")).toBe(true);
  });

  it("world cards show relative updated stamps", () => {
    useScriptorium.getState().addProject("Stamper");
    render(wrap());
    expect(screen.getByText(/Updated (just now|a minute ago|1 minute ago|\d+ (minutes?|hours?) ago|today)/i)).toBeInTheDocument();
  });

  it("search and sort appear at three worlds and filter the list", () => {
    useScriptorium.getState().addProject("Amber Library");
    useScriptorium.getState().addProject("Bastion");
    useScriptorium.getState().addProject("Cinder March");
    render(wrap());
    const section = screen.getByRole("region", { name: "My worlds" });
    expect(within(section).getByRole("searchbox", { name: /search worlds/i })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: /search worlds/i }), { target: { value: "bas" } });
    expect(within(section).getByText("Bastion")).toBeInTheDocument();
    expect(within(section).queryByText("Cinder March")).toBeNull();
  });

  it("sort by name orders cards A–Z", () => {
    ["Zulu", "Alder", "Mirren"].forEach((n) => useScriptorium.getState().addProject(n));
    render(wrap());
    const sel = screen.getByLabelText(/sort/i);
    fireEvent.change(sel, { target: { value: "name" } });
    const h2 = screen.getByRole("heading", { name: "My worlds" });
    const grid = h2.parentElement!.nextElementSibling as HTMLElement;
    const cards = within(grid).getAllByRole("heading").map((h) => h.textContent);
    expect(cards).toEqual(["Alder", "Mirren", "Zulu"]);
  });

  it("keeps the sample-project invite in the empty worlds list", () => {
    render(wrap());
    expect(screen.getByText(/create your first world or load the sample/i)).toBeInTheDocument();
  });
});
