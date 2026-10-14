import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

let anchorHref = "";
let anchorDownload = "";
let restoreAnchor = () => {};

function stubAnchorDownload() {
  const orig = document.createElement.bind(document);
  document.createElement = ((tag: string) => {
    const el = orig(tag) as HTMLAnchorElement;
    if (tag === "a") {
      el.click = () => {
        anchorHref = el.href;
        anchorDownload = el.download;
      };
    }
    return el as never;
  }) as typeof document.createElement;
  const origCreateObjectUrl = URL.createObjectURL;
  const origRevokeObjectUrl = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
  restoreAnchor = () => {
    document.createElement = orig;
    URL.createObjectURL = origCreateObjectUrl;
    URL.revokeObjectURL = origRevokeObjectUrl;
  };
}

afterEach(() => {
  restoreAnchor();
  restoreAnchor = () => {};
  anchorHref = "";
  anchorDownload = "";
});

describe("shell routes", () => {
  it("root shows library", () => {
    render(at("/"));
    expect(screen.getByText(/Scriptorium/)).toBeInTheDocument();
  });

  it("unknown project redirects to library with a toast", async () => {
    render(at("/p/does-not-exist"));
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => /não existe/i.test(t.message))).toBe(true);
    });
    expect(screen.getByText(/Scriptorium/)).toBeInTheDocument();
  });

  it("workspace overview shows counts and rail sections", () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    render(at(`/p/${p.id}`));
    expect(screen.getAllByText(/Shimradis/).length).toBeGreaterThan(0);
    const rail = within(screen.getByRole("navigation", { name: /Seções do mundo/i }));
    expect(rail.getByRole("link", { name: /Visão Geral/i })).toHaveAttribute("href", `/p/${p.id}`);
    expect(rail.getByRole("link", { name: /Atlas/i })).toHaveAttribute("href", `/p/${p.id}/atlas`);
    expect(rail.getByRole("link", { name: /Códex/i })).toHaveAttribute("href", `/p/${p.id}/entries`);
    expect(rail.getByRole("link", { name: /Livro/i })).toHaveAttribute("href", `/p/${p.id}/manuscript`);
  });

  it("atlas placeholder explains next step", () => {
    const p = useScriptorium.getState().addProject("X");
    render(at(`/p/${p.id}/atlas`));
    expect(screen.getByText(/sub-projeto 2/i)).toBeInTheDocument();
  });

  it("export downloads a JSON file", () => {
    const p = useScriptorium.getState().addProject("Exported");
    stubAnchorDownload();
    render(at(`/p/${p.id}`));
    fireEvent.click(screen.getByRole("button", { name: /exportar/i }));
    expect(anchorHref).toContain("blob:");
    expect(anchorDownload).toBe("Exported.scriptorium.json");
  });
});