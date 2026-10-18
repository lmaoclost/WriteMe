import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

function at(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>
  );
}

describe("delete then undo on index pages", () => {
  it("deleting an idea board offers Undo that restores it", async () => {
    const p = useScriptorium.getState().addProject("P");
    act(() => { useScriptorium.getState().addWellSpring(p.id, "Muse ideas"); });
    render(at(`/p/${p.id}/wellspring`));
    fireEvent.click(screen.getByRole("button", { name: /Delete idea board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(useScriptorium.getState().wellsprings ?? []).toHaveLength(0);
    const undo = await screen.findByRole("button", { name: "Undo" });
    fireEvent.click(undo);
    expect((useScriptorium.getState().wellsprings ?? []).map((w) => w.name)).toContain("Muse ideas");
  });

  it("undo offers the book delete on the manuscript page", async () => {
    const p = useScriptorium.getState().addProject("P");
    act(() => { useScriptorium.getState().addManuscript(p.id, "Cantar de Vellmora"); });
    render(at(`/p/${p.id}/manuscript`));
    fireEvent.click(screen.getByRole("button", { name: /Delete book/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    expect(useScriptorium.getState().manuscripts ?? []).toHaveLength(0);
    const undo = await screen.findByRole("button", { name: "Undo" });
    fireEvent.click(undo);
    expect((useScriptorium.getState().manuscripts ?? []).map((m) => m.title)).toContain("Cantar de Vellmora");
  });

  it("a stale undo toast says so instead of undoing the wrong delete", async () => {
    const p = useScriptorium.getState().addProject("P");
    act(() => { useScriptorium.getState().addWellSpring(p.id, "A"); });
    act(() => { useScriptorium.getState().addConlang(p.id, "B"); });
    render(at(`/p/${p.id}/wellspring`));
    fireEvent.click(screen.getByRole("button", { name: /Delete idea board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("button", { name: "Undo" });
    // another delete lands while the first toast is still visible
    act(() => { useScriptorium.getState().deleteConlang((useScriptorium.getState().conlangs ?? [])[0]!.id); });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await screen.findByText("Nothing left to undo.");
    expect(useScriptorium.getState().wellsprings ?? []).toHaveLength(0);
  });
});