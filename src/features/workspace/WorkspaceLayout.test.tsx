import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";

async function at(path: string): Promise<ReturnType<typeof render>> {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.queryByTestId("hydration-splash")).toBeNull();
    expect(screen.queryByTestId("chunk-splash")).toBeNull();
  }, { timeout: 10000 });
  return view;
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("workspace rail", () => {
  it("shows the current world name linking to the overview", async () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    await at(`/p/${p.id}/entries`);
    const rail = within(screen.getByRole("navigation", { name: /world sections/i }));
    const link = rail.getByRole("link", { name: /Shimradis/ });
    expect(link).toHaveAttribute("href", `/p/${p.id}`);
  });

  it("rail world block differs from the My worlds link", async () => {
    const p = useScriptorium.getState().addProject("Second World");
    await at(`/p/${p.id}`);
    const rail = within(screen.getByRole("navigation", { name: /world sections/i }));
    expect(rail.getByRole("link", { name: /My worlds/i })).toHaveAttribute("href", "/");
    expect(rail.getByRole("link", { name: /second world/i })).toBeInTheDocument();
  });

  it("groups sections under group headers with icons", async () => {
    const p = useScriptorium.getState().addProject("G");
    await at(`/p/${p.id}`);
    const rail = within(screen.getByRole("navigation", { name: /world sections/i }));
    for (const g of ["Reference", "Relations", "Worldbuilding", "Writing"]) {
      expect(rail.getByText(g)).toBeInTheDocument();
    }
    const lore = rail.getByRole("link", { name: /Lore/i });
    const icon = lore.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("scrolls the rail links instead of clipping them on short viewports", async () => {
    const p = useScriptorium.getState().addProject("Tall");
    await at(`/p/${p.id}`);
    const nav = screen.getByRole("navigation", { name: /world sections/i });
    const scroller = screen.getByTestId("rail-scroll");
    expect(nav.contains(scroller)).toBe(true);
    expect(scroller.className).toContain("overflow-y-auto");
    expect(scroller.className).not.toContain("overflow-y-hidden");
  });

  it("keeps the language and theme toggles out of the scrolling area", async () => {
    const p = useScriptorium.getState().addProject("Docked");
    await at(`/p/${p.id}`);
    const scroller = screen.getByTestId("rail-scroll");
    for (const button of screen.getAllByRole("button", { name: /switch to/i })) {
      expect(scroller).not.toContainElement(button);
    }
    expect(scroller).not.toContainElement(screen.getByRole("button", { name: /search/i }));
  });

  it("keeps every section label and route", async () => {
    const p = useScriptorium.getState().addProject("R");
    await at(`/p/${p.id}`);
    const rail = within(screen.getByRole("navigation", { name: /world sections/i }));
    const labels = [
      "Overview", "Atlas", "Lore", "Chronology", "Bloodline", "Factions", "Calendar",
      "Plot board", "Timeline", "Oaths", "Ideas", "Language", "Manuscript", "Publishing",
    ];
    for (const label of labels) {
      expect(rail.getByText(label)).toBeInTheDocument();
    }
    expect(rail.getByRole("link", { name: /Publishing/i })).toHaveAttribute("href", `/p/${p.id}/bindery`);
  });

  it("switches the rail and pages to Portuguese", async () => {
    const p = useScriptorium.getState().addProject("R");
    await at(`/p/${p.id}`);
    const rail = within(screen.getByRole("navigation", { name: /world sections/i }));

    fireEvent.click(rail.getByRole("button", { name: "Switch to Portuguese" }));

    const nav = await screen.findByRole("navigation", { name: "Seções do mundo" });
    const ptRail = within(nav);
    expect(ptRail.getByRole("link", { name: "Visão geral" })).toHaveAttribute("href", `/p/${p.id}`);
    expect(ptRail.getByRole("link", { name: /Meus mundos/ })).toHaveAttribute("href", "/");
    expect(ptRail.getByText("Referência")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("pt-BR");
  });
});
