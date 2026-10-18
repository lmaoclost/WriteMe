import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { fileToDataUrl } from "../../data/image";
import { useScriptorium } from "../../data/store";

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
    expect(rail.getByRole("link", { name: /My worlds/i })).toHaveAttribute("href", "/");
  });

  it("atlas route shows the atlas index (not a placeholder)", () => {
    const p = useScriptorium.getState().addProject("X");
    render(at(`/p/${p.id}/atlas`));
    expect(screen.getByText("No saved atlases found. Create a new one first!")).toBeInTheDocument();
    expect(screen.queryByText(/sub-projeto 2/i)).not.toBeInTheDocument();
  });

});

describe("overview cover", () => {
  it("uploads a cover from file and records image key", async () => {
    const p = useScriptorium.getState().addProject("Coberto");
    render(at(`/p/${p.id}`));
    fireEvent.change(screen.getByLabelText("Change cover"), {
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
    fireEvent.change(screen.getByLabelText("Change cover"), {
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
    fireEvent.change(screen.getByLabelText("Change cover"), {
      target: { files: [new File(["c"], "capa.png", { type: "image/png" })] },
    });
    await waitFor(() =>
      expect(useScriptorium.getState().toasts.some((t) => t.kind === "error")).toBe(true));
    expect(useScriptorium.getState().projects.find((q) => q.id === p.id)?.coverImageKey).toBeFalsy();
  });
});

describe("overview dashboard", () => {
  function seeded() {
    act(() => { useScriptorium.getState().seedDemo(); });
    const id = useScriptorium.getState().projects[0].id;
    return id;
  }

  it("ledger lists all 11 forge rows with counters after seeding", () => {
    const pid = seeded();
    render(at(`/p/${pid}`));
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getAllByRole("listitem")).toHaveLength(12);
    ["Codex", "Atlas", "Bloodline", "Oaths", "Factions", "Calendar",
     "Plot board", "Timeline wheel", "Wellspring", "Conlang", "Manuscript", "Bindery"]
      .forEach((n) => expect(ledger.getByText(n)).toBeInTheDocument());
  });

  it("counter numbers match the world state", () => {
    const pid = seeded();
    render(at(`/p/${pid}`));
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getByLabelText("Codex entries")).toHaveTextContent("16");
    expect(ledger.getByLabelText("Bloodline persons")).toHaveTextContent("6");
    expect(ledger.getByLabelText("Calendar events")).toHaveTextContent("9");
    expect(ledger.getByLabelText("Conlang words")).toHaveTextContent("12");
    expect(ledger.getByLabelText("Plot board cards")).toHaveTextContent("7");
  });

  it("rows link to each forge page", () => {
    const pid = seeded();
    render(at(`/p/${pid}`));
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getByRole("link", { name: /Plot board/i })).toHaveAttribute("href", `/p/${pid}/plotboard`);
    expect(ledger.getByRole("link", { name: /Wellspring/i })).toHaveAttribute("href", `/p/${pid}/wellspring`);
    expect(ledger.getByRole("link", { name: /Oaths/i })).toHaveAttribute("href", `/p/${pid}/oaths`);
    expect(ledger.getByRole("link", { name: /Codex/i })).toHaveAttribute("href", `/p/${pid}/entries`);
  });

  it("portability actions are gone from the overview", () => {
    const pid = seeded();
    render(at(`/p/${pid}`));
    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /import/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /example/i })).toBeNull();
  });

  it("hero shows the world name in EN with a cover control", () => {
    const pid = seeded();
    render(at(`/p/${pid}`));
    expect(screen.getByRole("heading", { level: 1, name: /Vellmora/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/change cover/i)).toBeInTheDocument();
  });

  it("empty counters render an em dash when the forge has no data", () => {
    const pid = useScriptorium.getState().addProject("Blank world").id;
    render(at(`/p/${pid}`));
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getByLabelText("Bloodline persons")).toHaveTextContent("—");
    expect(ledger.getByLabelText("Conlang words")).toHaveTextContent("—");
  });
});
describe("Bindery index", () => {
  it("rail gains a Bindery item and the ledger row points at the index", () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    render(at(`/p/${p.id}`));
    const rail = within(screen.getByRole("navigation", { name: /world sections/i }));
    expect(rail.getByRole("link", { name: "Bindery" })).toHaveAttribute("href", `/p/${p.id}/bindery`);
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getByRole("link", { name: /Bindery/i })).toHaveAttribute("href", `/p/${p.id}/bindery`);
  });

  it("index lists manuscripts with chapter counts and links into the deep route", () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    act(() => { useScriptorium.getState().addManuscript(p.id, "Cantar de Vellmora"); });
    act(() => { useScriptorium.getState().addChapter(useScriptorium.getState().manuscripts[0].id, "Arco da Coroa"); });
    act(() => { useScriptorium.getState().setBindery(useScriptorium.getState().manuscripts[0].id, { trim: "5x8" }); });
    render(at(`/p/${p.id}/bindery`));
    expect(screen.getByRole("heading", { name: "Bindery" })).toBeInTheDocument();
    const row = screen.getByRole("link", { name: /Cantar de Vellmora/i });
    expect(row.getAttribute("href")).toBe(`/p/${p.id}/bindery/${useScriptorium.getState().manuscripts[0].id}`);
    expect(screen.getByText(/1 chapter/i)).toBeInTheDocument();
    expect(screen.getByText(/5 × 8/i)).toBeInTheDocument();
  });

  it("empty index invites creating a manuscript in the Manuscript forge", () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    render(at(`/p/${p.id}/bindery`));
    expect(screen.getByText(/no manuscripts yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the manuscript/i })).toHaveAttribute("href", `/p/${p.id}/manuscript`);
  });

  it("deep route still configures the specific manuscript", () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    act(() => { useScriptorium.getState().addManuscript(p.id, "Cantar"); });
    render(at(`/p/${p.id}/bindery/${useScriptorium.getState().manuscripts[0].id}`));
    expect(screen.getByLabelText("Typography")).toBeInTheDocument();
  });
});
