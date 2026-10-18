import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";

function at(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("workspace rail", () => {
  it("shows the current world name linking to the overview", () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    render(at(`/p/${p.id}/entries`));
    const rail = within(screen.getByRole("navigation", { name: /world sections/i }));
    const link = rail.getByRole("link", { name: /Shimradis/ });
    expect(link).toHaveAttribute("href", `/p/${p.id}`);
  });

  it("rail world block differs from the My worlds link", () => {
    const p = useScriptorium.getState().addProject("Second World");
    render(at(`/p/${p.id}`));
    const rail = within(screen.getByRole("navigation", { name: /world sections/i }));
    expect(rail.getByRole("link", { name: /My worlds/i })).toHaveAttribute("href", "/");
    expect(rail.getByRole("link", { name: /second world/i })).toBeInTheDocument();
  });
});
