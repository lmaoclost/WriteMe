import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { fileToDataUrl } from "../../data/image";
import { useScriptorium } from "../../data/store";
import type { Project } from "../../domain/types";

vi.mock("../../data/image", () => ({
  fileToDataUrl: vi.fn(async () => ({ dataUrl: "data:image/png;base64,COVER", keptPng: true })),
}));

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
    expect(screen.getByText("Scriptorium")).toBeInTheDocument();
  });

  it("unknown project redirects to library with a toast", async () => {
    render(at("/p/does-not-exist"));
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => /removed/i.test(t.message))).toBe(true);
    });
    expect(screen.getByText("Scriptorium")).toBeInTheDocument();
  });

  it("workspace overview shows counts and rail sections", () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    render(at(`/p/${p.id}`));
    expect(screen.getAllByText(/Shimradis/).length).toBeGreaterThan(0);
    const rail = within(screen.getByRole("navigation", { name: /World sections/i }));
    expect(rail.getByRole("link", { name: /Overview/i })).toHaveAttribute("href", `/p/${p.id}`);
    expect(rail.getByRole("link", { name: /Atlas/i })).toHaveAttribute("href", `/p/${p.id}/atlas`);
    expect(rail.getByRole("link", { name: /Codex/i })).toHaveAttribute("href", `/p/${p.id}/entries`);
    expect(rail.getByRole("link", { name: /Manuscript/i })).toHaveAttribute("href", `/p/${p.id}/manuscript`);
  });

  it("atlas route shows the atlas index (not a placeholder)", () => {
    const p = useScriptorium.getState().addProject("X");
    render(at(`/p/${p.id}/atlas`));
    expect(screen.getByText("No saved atlases found. Create a new one first!")).toBeInTheDocument();
    expect(screen.queryByText(/sub-projeto 2/i)).not.toBeInTheDocument();
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

describe("overview seed and cover", () => {
  it("re-loads the demo from overview when requested", async () => {
    let p!: Project;
    act(() => { p = useScriptorium.getState().addProject("Base"); });
    act(() => { useScriptorium.setState({ seedFlag: true }); });
    render(at(`/p/${p.id}`));
    fireEvent.click(screen.getByRole("button", { name: /recriar exemplo/i }));
    await waitFor(() => expect(useScriptorium.getState().entries.length).toBeGreaterThan(0));
    expect(useScriptorium.getState().projects).toHaveLength(2);
    expect(useScriptorium.getState().toasts.some((t) => t.message === "Projeto de exemplo carregado.")).toBe(true);
  });

  it("no seed button while seed not yet used", () => {
    const p = useScriptorium.getState().addProject("Base");
    render(at(`/p/${p.id}`));
    expect(screen.queryByRole("button", { name: /exemplo/i })).toBeNull();
  });

  it("uploads a cover from file and records image key", async () => {
    const p = useScriptorium.getState().addProject("Coberto");
    render(at(`/p/${p.id}`));
    fireEvent.change(screen.getByLabelText(/trocar capa/i), {
      target: { files: [new File(["c"], "capa.png", { type: "image/png" })] },
    });
    await waitFor(() =>
      expect(useScriptorium.getState().projects.find((q) => q.id === p.id)?.coverImageKey).toBeTruthy());
    const s = useScriptorium.getState();
    const key = s.projects.find((q) => q.id === p.id)?.coverImageKey;
    expect(key).toContain("cover");
    expect(Object.keys(s.images)).toHaveLength(1);
    expect(key && s.images[key]).toBe("data:image/png;base64,COVER");
    expect(s.toasts.some((t) => t.kind === "success")).toBe(true);
  });

  it("replaces an existing cover, removing the old image", async () => {
    const p = useScriptorium.getState().addProject("Coberto");
    let oldKey!: string;
    act(() => { oldKey = useScriptorium.getState().putImage("data:image/png;base64,OLD", "cover"); });
    act(() => { useScriptorium.getState().updateProject(p.id, { coverImageKey: oldKey }); });
    render(at(`/p/${p.id}`));
    fireEvent.change(screen.getByLabelText(/trocar capa/i), {
      target: { files: [new File(["c"], "capa.png", { type: "image/png" })] },
    });
    await waitFor(() => {
      const s = useScriptorium.getState();
      const key = s.projects.find((q) => q.id === p.id)?.coverImageKey;
      expect(key).toBeTruthy();
      expect(key).not.toBe(oldKey);
    });
    const s = useScriptorium.getState();
    expect(s.images[oldKey]).toBeUndefined();
    expect(Object.keys(s.images)).toHaveLength(1);
  });

  it("shows an error toast when cover upload fails", async () => {
    vi.mocked(fileToDataUrl).mockRejectedValueOnce(new Error("boom"));
    const p = useScriptorium.getState().addProject("Falha");
    render(at(`/p/${p.id}`));
    fireEvent.change(screen.getByLabelText(/trocar capa/i), {
      target: { files: [new File(["c"], "capa.png", { type: "image/png" })] },
    });
    await waitFor(() =>
      expect(useScriptorium.getState().toasts.some((t) => t.kind === "error")).toBe(true));
    expect(useScriptorium.getState().projects.find((q) => q.id === p.id)?.coverImageKey).toBeFalsy();
  });
});
