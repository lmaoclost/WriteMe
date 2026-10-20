import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { fileToDataUrl } from "../../data/image";
import { useScriptorium } from "../../data/store";

vi.mock("../../data/image", () => ({
  fileToDataUrl: vi.fn(async () => ({ dataUrl: "data:image/png;base64,COVER", keptPng: true })),
}));

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

describe("shell routes", () => {
  it("root shows library", async () => {
    await at("/");
    expect(screen.getByText("Scriptorium")).toBeInTheDocument();
  });

  it("unknown project redirects to library with a toast", async () => {
    await at("/p/does-not-exist");
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => /removed/i.test(t.message))).toBe(true);
    });
    expect(screen.getByText("Scriptorium")).toBeInTheDocument();
  });

  it("workspace overview shows counts and rail sections", async () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    await at(`/p/${p.id}`);
    expect(screen.getAllByText(/Shimradis/).length).toBeGreaterThan(0);
    const rail = within(screen.getByRole("navigation", { name: /World sections/i }));
    expect(rail.getByRole("link", { name: /Overview/i })).toHaveAttribute("href", `/p/${p.id}`);
    expect(rail.getByRole("link", { name: /Atlas/i })).toHaveAttribute("href", `/p/${p.id}/atlas`);
    expect(rail.getByRole("link", { name: /Lore/i })).toHaveAttribute("href", `/p/${p.id}/entries`);
    expect(rail.getByRole("link", { name: /Manuscript/i })).toHaveAttribute("href", `/p/${p.id}/manuscript`);
    expect(rail.getByRole("link", { name: /My worlds/i })).toHaveAttribute("href", "/");
  });

  it("atlas route shows the atlas index (not a placeholder)", async () => {
    const p = useScriptorium.getState().addProject("X");
    await at(`/p/${p.id}/atlas`);
    expect(screen.getByText("No saved atlases found. Create a new one first!")).toBeInTheDocument();
    expect(screen.queryByText(/sub-projeto 2/i)).not.toBeInTheDocument();
  });

});

describe("overview cover", () => {
  it("uploads a cover from file and records image key", async () => {
    const p = useScriptorium.getState().addProject("Coberto");
    await at(`/p/${p.id}`);
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
    await at(`/p/${p.id}`);
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
    await at(`/p/${p.id}`);
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

  it("ledger lists all 13 forge rows with counters after seeding", async () => {
    const pid = seeded();
    await at(`/p/${pid}`);
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getAllByRole("listitem")).toHaveLength(13);
    ["Lore", "Atlas", "Chronology", "Bloodline", "Oaths", "Factions",
     "Calendar", "Plot board", "Timeline", "Ideas", "Language", "Manuscript", "Publishing"]
      .forEach((n) => expect(ledger.getByText(n)).toBeInTheDocument());
  });

  it("counter numbers match the world state", async () => {
    const pid = seeded();
    await at(`/p/${pid}`);
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getByLabelText("Lore entries")).toHaveTextContent("16");
    expect(ledger.getByLabelText("Chronology events")).toHaveTextContent("1");
    expect(ledger.getByLabelText("Bloodline persons")).toHaveTextContent("6");
    expect(ledger.getByLabelText("Calendar events")).toHaveTextContent("9");
    expect(ledger.getByLabelText("Lexicon words")).toHaveTextContent("12");
    expect(ledger.getByLabelText("Plot board cards")).toHaveTextContent("7");
  });

  it("rows link to each forge page", async () => {
    const pid = seeded();
    await at(`/p/${pid}`);
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getByRole("link", { name: /Plot board/i })).toHaveAttribute("href", `/p/${pid}/plotboard`);
    expect(ledger.getByRole("link", { name: /Ideas/i })).toHaveAttribute("href", `/p/${pid}/wellspring`);
    expect(ledger.getByRole("link", { name: /Oaths/i })).toHaveAttribute("href", `/p/${pid}/oaths`);
    expect(ledger.getByRole("link", { name: /Lore/i })).toHaveAttribute("href", `/p/${pid}/entries`);
    expect(ledger.getByRole("link", { name: /Chronology/i })).toHaveAttribute("href", `/p/${pid}/timeline`);
  });

  it("portability actions are gone from the overview", async () => {
    const pid = seeded();
    await at(`/p/${pid}`);
    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /import/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /example/i })).toBeNull();
  });

  it("hero shows the world name in EN with a cover control", async () => {
    const pid = seeded();
    await at(`/p/${pid}`);
    expect(screen.getByRole("heading", { level: 1, name: /Vellmora/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/change cover/i)).toBeInTheDocument();
  });

  it("empty rows show a purpose line and an action call instead of a dash", async () => {
    const pid = useScriptorium.getState().addProject("Blank world").id;
    await at(`/p/${pid}`);
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getByText("Characters, places, creatures and things")).toBeInTheDocument();
    expect(ledger.getByText("Map regions and drop pins for places")).toBeInTheDocument();
    const call = ledger.getByRole("link", { name: /Write your first entry/i });
    expect(call).toHaveAttribute("href", `/p/${pid}/entries`);
    expect(ledger.getByRole("link", { name: "Add a dated event" })).toHaveAttribute("href", `/p/${pid}/timeline`);
    expect(ledger.getByRole("link", { name: "Draw your first region" })).toBeInTheDocument();
    expect(ledger.getByRole("link", { name: "Open an idea board" })).toBeInTheDocument();
  });

  it("non-empty rows keep counters over the action call", async () => {
    const pid = seeded();
    await at(`/p/${pid}`);
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getByLabelText("Lore entries")).toHaveTextContent("16");
    expect(ledger.queryByText(/Write your first entry/i)).toBeNull();
  });
});
describe("Bindery index", () => {
  it("rail gains a Publishing item and the ledger row points at the index", async () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    await at(`/p/${p.id}`);
    const rail = within(screen.getByRole("navigation", { name: /world sections/i }));
    expect(rail.getByRole("link", { name: "Publishing" })).toHaveAttribute("href", `/p/${p.id}/bindery`);
    const ledger = within(screen.getByRole("region", { name: "Forge ledger" }));
    expect(ledger.getByRole("link", { name: /Publishing/i })).toHaveAttribute("href", `/p/${p.id}/bindery`);
  });

  it("index lists manuscripts with chapter counts and links into the deep route", async () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    act(() => { useScriptorium.getState().addManuscript(p.id, "Cantar de Vellmora"); });
    act(() => { useScriptorium.getState().addChapter(useScriptorium.getState().manuscripts[0].id, "Arco da Coroa"); });
    act(() => { useScriptorium.getState().setBindery(useScriptorium.getState().manuscripts[0].id, { trim: "5x8" }); });
    await at(`/p/${p.id}/bindery`);
    expect(screen.getByRole("heading", { name: "Publishing" })).toBeInTheDocument();
    const row = screen.getByRole("link", { name: /Cantar de Vellmora/i });
    expect(row.getAttribute("href")).toBe(`/p/${p.id}/bindery/${useScriptorium.getState().manuscripts[0].id}`);
    expect(screen.getByText(/1 chapter/i)).toBeInTheDocument();
    expect(screen.getByText(/5 × 8/i)).toBeInTheDocument();
  });

  it("empty index invites creating a manuscript in the Manuscript forge", async () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    await at(`/p/${p.id}/bindery`);
    expect(screen.getByText(/no manuscripts yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open the manuscript/i })).toHaveAttribute("href", `/p/${p.id}/manuscript`);
  });

  it("deep route still configures the specific manuscript", async () => {
    const p = useScriptorium.getState().addProject("Shimradis");
    act(() => { useScriptorium.getState().addManuscript(p.id, "Cantar"); });
    await at(`/p/${p.id}/bindery/${useScriptorium.getState().manuscripts[0].id}`);
    expect(screen.getByLabelText("Typography")).toBeInTheDocument();
  });
});
