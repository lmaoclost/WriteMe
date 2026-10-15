import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CodexPage } from "./CodexPage";
import { PinPanel } from "../atlas/panels/PinPanel";
import { RegionPanel } from "../atlas/panels/RegionPanel";
import { useScriptorium } from "../../data/store";
import type { Pin, Region, WorldEntry } from "../../domain/types";

const store = () => useScriptorium.getState();

interface Fixture {
  projectId: string;
  atlasId: string;
  pin: Pin;
  region: Region;
  entries: WorldEntry[];
}

function seed(): Fixture {
  const project = store().addProject("Vellmora");
  const atlas = store().addAtlas(project.id, "Mapa do Mundo");
  const rio = store().addEntry(project.id, "place");
  store().updateEntry(rio.id, { title: "Rio Sarnen" });
  const aldric = store().addEntry(project.id, "person");
  store().updateEntry(aldric.id, { title: "Aldric" });
  const pin = store().addPin(atlas.id, { x: 0.5, y: 0.5, label: "Cidade", entryId: rio.id });
  const region = store().addRegion(atlas.id, {
    points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
    label: "Vale",
    entryId: aldric.id,
  });
  store().putMapImage(atlas.id, "data:image/svg+xml,%3Csvg/%3E");
  return {
    projectId: project.id,
    atlasId: atlas.id,
    pin: pin as Pin,
    region: region as Region,
    entries: store().entries.filter((e) => e.projectId === project.id),
  };
}

function routesFor(f: Fixture, panel: ReactNode) {
  return (
    <MemoryRouter initialEntries={[`/p/${f.projectId}/atlas/${f.atlasId}`]}>
      <Routes>
        <Route path="/p/:projectId">
          <Route path="atlas/:atlasId" element={panel} />
          <Route path="entries" element={<CodexPage projectId={f.projectId} />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("Atlas → codex navigation", () => {
  it("pin link title navigates to the codex with that entry selected", () => {
    const f = seed();
    render(routesFor(f, <PinPanel pin={f.pin} entries={f.entries} onDelete={vi.fn()} />));
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Link entry" }));
    });
    const titleButton = screen.getByRole("button", { name: "Rio Sarnen" });
    expect(titleButton).toHaveClass("link-current");
    act(() => {
      fireEvent.click(titleButton);
    });
    expect(screen.getByLabelText("Title")).toHaveValue("Rio Sarnen");
    expect(screen.getByRole("button", { name: "Rio Sarnen" })).toHaveClass("active");
  });

  it("region link title navigates to the codex with that entry selected", () => {
    const f = seed();
    render(routesFor(f, <RegionPanel atlasId={f.atlasId} region={f.region} entries={f.entries} onDelete={vi.fn()} />));
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Link entry" }));
    });
    const titleButton = screen.getByRole("button", { name: "Aldric" });
    expect(titleButton).toHaveClass("link-current");
    act(() => {
      fireEvent.click(titleButton);
    });
    expect(screen.getByLabelText("Title")).toHaveValue("Aldric");
  });

  it("keeps the picker open behavior: pick and unlink still work", () => {
    const f = seed();
    render(routesFor(f, <PinPanel pin={f.pin} entries={f.entries} onDelete={vi.fn()} />));
    expect(screen.getByRole("button", { name: "Link entry" })).toBeInTheDocument();
    // Picker is closed: open it, pick another entry, panel writes entryId.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Link entry" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Aldric" }));
    });
    const pin = store().atlases[0].pins[0];
    expect(pin.entryId).toBe(f.entries[1].id);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Link entry" }));
    });
    act(() => {
      fireEvent.click(screen.getByLabelText(/Unlink Rio Sarnen/));
    });
    expect(store().atlases[0].pins[0].entryId).toBeUndefined();
    expect(screen.getByRole("button", { name: "Link entry" })).toBeInTheDocument();
  });
});
