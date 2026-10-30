import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRouter } from "../../app/router";
import { useWriteme } from "../../data/store";

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
  useWriteme.setState(useWriteme.getInitialState());
});

async function projectRender(path: string): Promise<void> {
  const p = useWriteme.getState().addProject("P");
  await at(path.replace(":pid", p.id));
}

describe("index page purpose lines", () => {
  it("Atlas states what it is for", async () => {
    await projectRender("/p/:pid/atlas");
    expect(screen.getByRole("heading", { name: "Atlas" })).toBeInTheDocument();
    expect(screen.getByText("Map regions and drop pins for places.")).toBeInTheDocument();
  });

  it("Lore states what it is for", async () => {
    await projectRender("/p/:pid/entries");
    expect(screen.getByRole("heading", { name: "Lore" })).toBeInTheDocument();
    expect(screen.getByText("Characters, places, creatures and things.")).toBeInTheDocument();
  });

  it("Chronology states what it is for", async () => {
    await projectRender("/p/:pid/timeline");
    expect(screen.getByRole("heading", { name: "Chronology" })).toBeInTheDocument();
    expect(screen.getByText("Dated events in world order.")).toBeInTheDocument();
  });

  it("Manuscript empty state states what it is for", async () => {
    await projectRender("/p/:pid/manuscript");
    expect(screen.getByRole("heading", { name: "Manuscript" })).toBeInTheDocument();
    expect(screen.getByText("Write the chapters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New book/i })).toBeInTheDocument();
  });

  it("Publishing index states what it is for", async () => {
    await projectRender("/p/:pid/bindery");
    expect(screen.getByRole("heading", { name: "Publishing" })).toBeInTheDocument();
    expect(screen.getByText("Trim the manuscript for export.")).toBeInTheDocument();
  });

  it("pages that already have a purpose line keep them", async () => {
    await projectRender("/p/:pid/wellspring");
    expect(screen.getByText("Somewhere to put an idea before it has a home.")).toBeInTheDocument();
    cleanup();
    await projectRender("/p/:pid/oaths");
    expect(screen.getByText("Chart who answers to whom — courts, orders, armies and guilds.")).toBeInTheDocument();
  });
});
