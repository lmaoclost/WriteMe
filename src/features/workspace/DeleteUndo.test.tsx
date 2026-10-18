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
});