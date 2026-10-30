import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { fileToDataUrl } from "../../data/image";
import { useWriteme } from "../../data/store";
import type { Atlas, WorldEntry } from "../../domain/types";
import { resetRecentColors } from "./panels/recentColors";

vi.mock("../../data/image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../data/image")>()),
  fileToDataUrl: vi.fn(),
}));

const store = () => useWriteme.getState();
const MOCK_DATA_URL = "data:image/png;base64,MOCKMAP";

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
  resetRecentColors();
  vi.mocked(fileToDataUrl).mockReset();
  vi.mocked(fileToDataUrl).mockResolvedValue({ dataUrl: MOCK_DATA_URL, keptPng: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function seedProject(): string {
  let pid = "";
  act(() => {
    pid = store().addProject("Vale Sombrio").id;
  });
  return pid;
}

function addEntry(pid: string, title: string, withImage: boolean): WorldEntry {
  let imageKey: string | undefined;
  if (withImage) {
    act(() => {
      imageKey = store().putImage("data:image/png;base64,CODEXIMG", "entry");
    });
  }
  const entry: WorldEntry = {
    id: `ent_${title}`,
    projectId: pid,
    title,
    category: "place",
    body: "",
    imageKey,
    links: [],
  };
  act(() => {
    useWriteme.setState((s) => ({ entries: [...s.entries, entry] }));
  });
  return entry;
}

function seedAtlas(pid: string, { withMap = true, regions = 0, pins = 0 } = {}): Atlas {
  let id = "";
  act(() => {
    const a = store().addAtlas(pid, "Terras do Véu");
    id = a.id;
    if (withMap) store().putMapImage(a.id, "data:image/svg+xml,%3Csvg/%3E");
    for (let i = 0; i < regions; i++) {
      store().addRegion(a.id, { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] });
    }
    for (let i = 0; i < pins; i++) {
      store().addPin(a.id, { x: (i + 1) / (pins + 1), y: 0.5 });
    }
  });
  return store().atlases.find((a) => a.id === id)!;
}

function stubStageLayout(stageEl: HTMLElement) {
  stageEl.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  Object.defineProperty(stageEl, "clientWidth", { configurable: true, value: 800 });
  Object.defineProperty(stageEl, "clientHeight", { configurable: true, value: 600 });
  const img = stageEl.querySelector(".stage-map") as HTMLImageElement | null;
  if (img) {
    Object.defineProperty(img, "naturalWidth", { configurable: true, value: 800 });
    Object.defineProperty(img, "naturalHeight", { configurable: true, value: 600 });
    act(() => {
      fireEvent.load(img);
    });
  }
}

async function mountEditor(pid: string, atlasId: string): Promise<{ container: HTMLElement; stageEl: HTMLElement }> {
  const { container } = await at(`/p/${pid}/atlas/${atlasId}`);
  const stageEl = screen.getByTestId("stage");
  stubStageLayout(stageEl);
  return { container, stageEl };
}

function pickTool(name: string) {
  act(() => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

function clickStage(stageEl: HTMLElement, x: number, y: number, pointerId = 1) {
  const fire = (type: string, buttons: number) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(e, {
      clientX: { value: x },
      clientY: { value: y },
      button: { value: 0 },
      buttons: { value: buttons },
      pointerId: { value: pointerId },
      pointerType: { value: "mouse" },
    });
    stageEl.dispatchEvent(e);
  };
  act(() => {
    fire("pointerdown", 1);
    fire("pointerup", 0);
  });
}

function drawTestRegion(stageEl: HTMLElement) {
  pickTool("Region");
  clickStage(stageEl, 100, 60, 41);
  clickStage(stageEl, 300, 120, 42);
  clickStage(stageEl, 260, 220, 43);
  act(() => {
    fireEvent.keyDown(document, { key: "Enter" });
  });
}

describe("AtlasIndexPage", () => {
  it("renders cards with name, counts and thumbnail from images[mapImageKey]", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: true, regions: 3, pins: 4 });
    await at(`/p/${pid}/atlas`);
    const card = screen.getByText("Terras do Véu").closest("article");
    expect(card).toBeTruthy();
    expect(within(card as HTMLElement).getByText("3 regions · 4 pins")).toBeTruthy();
    const thumb = within(card as HTMLElement).getByRole("img") as HTMLImageElement;
    expect(thumb.src).toBe(store().images[atlas.mapImageKey!]);
    expect(screen.queryByText("No saved atlases found. Create a new one first!")).toBeNull();
  });

  it("shows the empty state when the project has no atlas", async () => {
    const pid = seedProject();
    await at(`/p/${pid}/atlas`);
    expect(screen.getByText("No saved atlases found. Create a new one first!")).toBeTruthy();
  });

  it("creates an atlas via the modal and navigates to its editor", async () => {
    const pid = seedProject();
    await at(`/p/${pid}/atlas`);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "New atlas" }));
    });
    const dialog = screen.getByRole("dialog", { name: "New atlas" });
    const input = within(dialog).getByRole("textbox", { name: "Name" }) as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "Novo Mundo" } });
    });
    act(() => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    });
    const created = store().atlases.find((a) => a.projectId === pid && a.name === "Novo Mundo");
    expect(created).toBeTruthy();
    await waitFor(() => expect(document.querySelector(".atlas-editor")).toBeTruthy());
  });

  it("deletes an atlas with the two-step confirm", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: true });
    await at(`/p/${pid}/atlas`);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: `Delete atlas ${atlas.name}` }));
    });
    const btn = screen.getByRole("button", { name: `Delete atlas ${atlas.name}` });
    expect(btn.textContent).toBe("Confirm?");
    act(() => {
      fireEvent.click(btn);
    });
    expect(store().atlases).toHaveLength(0);
    expect(store().toasts.some((t) => t.kind === "success" && /deleted/i.test(t.message))).toBe(true);
  });
});

describe("MapDropzone", () => {
  it("renders when the atlas has no map; dropping a file loads it via putMapImage", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: false });
    const { container } = await mountEditor(pid, atlas.id);
    const zone = container.querySelector(".map-dropzone") as HTMLElement;
    expect(zone).toBeTruthy();
    expect(within(zone).getByText("Drag a map…")).toBeTruthy();
    const file = new File(["x"], "map.png", { type: "image/png" });
    act(() => {
      fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    });
    await waitFor(() => {
      const current = store().atlases.find((a) => a.id === atlas.id)!;
      expect(current.mapImageKey).toBeTruthy();
    });
    expect(store().toasts.some((t) => t.kind === "success" && t.message === "Map loaded.")).toBe(true);
    expect(vi.mocked(fileToDataUrl)).toHaveBeenCalledWith(file);
  });

  it("toasts an error and keeps the atlas mapless when the file fails", async () => {
    vi.mocked(fileToDataUrl).mockRejectedValueOnce(new Error("boom"));
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: false });
    const { container } = await mountEditor(pid, atlas.id);
    const zone = container.querySelector(".map-dropzone") as HTMLElement;
    const file = new File(["x"], "map.png", { type: "image/png" });
    act(() => {
      fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    });
    await waitFor(() => {
      expect(store().toasts.some((t) => t.kind === "error" && t.message === "Upload failed. Please try again.")).toBe(true);
    });
    expect(store().atlases.find((a) => a.id === atlas.id)!.mapImageKey).toBeUndefined();
  });

  it("dropzone is gone when a map exists; 'Substituir mapa' runs the same flow", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: true });
    const { container } = await mountEditor(pid, atlas.id);
    const prevKey = atlas.mapImageKey!;
    expect(container.querySelector(".map-dropzone")).toBeNull();
    expect(screen.getByRole("button", { name: "Replace map" })).toBeTruthy();
    const input = container.querySelector('input[aria-label="Map file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(["y"], "map2.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await waitFor(() => {
      const current = store().atlases.find((a) => a.id === atlas.id)!;
      expect(current.mapImageKey).toBeTruthy();
    });
    const newKey = store().atlases.find((a) => a.id === atlas.id)!.mapImageKey!;
    expect(newKey).not.toBe(prevKey);
    expect(store().toasts.some((t) => t.kind === "success" && t.message === "Map loaded.")).toBe(true);
  });
});

describe("EntryImagePicker", () => {
  it("lists only entries with an image; picking applies setAtlasMapFromEntry", async () => {
    const pid = seedProject();
    addEntry(pid, "Cidadela", true);
    addEntry(pid, "Ponte dos Ossos", true);
    addEntry(pid, "Registro vazio", false);
    const atlas = seedAtlas(pid, { withMap: true });
    await mountEditor(pid, atlas.id);
    const before = store().atlases.find((a) => a.id === atlas.id)!.mapImageKey!;
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Entry image" }));
    });
    const dialog = screen.getByRole("dialog", { name: "Entry image" });
    expect(within(dialog).getByText("Cidadela")).toBeTruthy();
    expect(within(dialog).getByText("Ponte dos Ossos")).toBeTruthy();
    expect(within(dialog).queryByText("Registro vazio")).toBeNull();
    act(() => {
      fireEvent.click(within(dialog).getByText("Cidadela"));
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Entry image" })).toBeNull();
    });
    const after = store().atlases.find((a) => a.id === atlas.id)!.mapImageKey!;
    expect(after).not.toBe(before);
    expect(store().toasts.some((t) => t.kind === "success" && t.message === "Map linked to the codex.")).toBe(true);
  });

  it("shows the empty state when no entry carries an image", async () => {
    const pid = seedProject();
    addEntry(pid, "Registro vazio", false);
    const atlas = seedAtlas(pid, { withMap: true });
    await mountEditor(pid, atlas.id);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Entry image" }));
    });
    const dialog = screen.getByRole("dialog", { name: "Entry image" });
    expect(within(dialog).getByText("No entries with images.")).toBeTruthy();
  });

  it("keeps the picker closed and raises the persist toast when the durable write fails", async () => {
    const pid = seedProject();
    addEntry(pid, "Cidadela", true);
    const atlas = seedAtlas(pid, { withMap: true });
    await mountEditor(pid, atlas.id);
    // IndexedDB writes fail → the durable sync cannot land → image survives in
    // memory for the session; the persist listener raises the shared toast.
    const restored = globalThis.indexedDB;
    globalThis.indexedDB = { open: () => { throw new Error("boom"); } } as unknown as IDBFactory;
    try {
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Entry image" }));
      });
      const dialog = screen.getByRole("dialog", { name: "Entry image" });
      act(() => {
        fireEvent.click(within(dialog).getByText("Cidadela"));
      });
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "Entry image" })).toBeNull();
      });
      await waitFor(() => {
        expect(store().toasts.some((t) => t.kind === "error" && t.message.includes("image"))).toBe(true);
      });
    } finally {
      globalThis.indexedDB = restored;
    }
  });
});

describe("atlas routes", () => {
  it("/p/:id/atlas renders the index, not the placeholder", async () => {
    const pid = seedProject();
    seedAtlas(pid);
    await at(`/p/${pid}/atlas`);
    expect(screen.getByText("Terras do Véu")).toBeTruthy();
    expect(screen.queryByText(/cravar pinos sobre o mapa/i)).toBeNull();
  });

  it("unknown atlasId redirects to the index with a toast", async () => {
    const pid = seedProject();
    await at(`/p/${pid}/atlas/atl_missing`);
    await waitFor(() => {
      expect(store().toasts.some((t) => t.kind === "error" && t.message === "Atlas not found.")).toBe(true);
    });
    expect(screen.getByText("No saved atlases found. Create a new one first!")).toBeTruthy();
  });
});

describe("editor header", () => {
  it("commits the rename on Enter", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: true });
    await mountEditor(pid, atlas.id);
    const input = screen.getByRole("textbox", { name: "Atlas name" }) as HTMLInputElement;
    expect(input.value).toBe("Terras do Véu");
    act(() => {
      fireEvent.change(input, { target: { value: "Vale Sombrio" } });
    });
    act(() => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(store().atlases[0].name).toBe("Vale Sombrio");
  });

  it("commits the rename on blur", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: true });
    await mountEditor(pid, atlas.id);
    const input = screen.getByRole("textbox", { name: "Atlas name" }) as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "Outro Nome" } });
    });
    act(() => {
      fireEvent.blur(input);
    });
    expect(store().atlases[0].name).toBe("Outro Nome");
  });

  it("undo/redo: disabled at start; a draw enables undo; ctrl+z undoes and redo restores", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: true });
    const { stageEl } = await mountEditor(pid, atlas.id);
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    drawTestRegion(stageEl);
    expect(store().atlases[0].regions).toHaveLength(1);
    expect(undo).not.toBeDisabled();
    act(() => {
      fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    });
    expect(store().atlases[0].regions).toHaveLength(0);
    expect(redo).not.toBeDisabled();
    act(() => {
      fireEvent.click(redo);
    });
    expect(store().atlases[0].regions).toHaveLength(1);
  });

  it("ctrl+shift+z and ctrl+y both redo (each restores the region ctrl+z removed)", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: true });
    const { stageEl } = await mountEditor(pid, atlas.id);
    drawTestRegion(stageEl);
    expect(store().atlases[0].regions).toHaveLength(1);
    act(() => {
      fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    });
    expect(store().atlases[0].regions).toHaveLength(0);
    act(() => {
      fireEvent.keyDown(document, { key: "z", ctrlKey: true, shiftKey: true });
    });
    expect(store().atlases[0].regions).toHaveLength(1);
    act(() => {
      fireEvent.keyDown(document, { key: "z", ctrlKey: true });
    });
    expect(store().atlases[0].regions).toHaveLength(0);
    act(() => {
      fireEvent.keyDown(document, { key: "y", ctrlKey: true });
    });
    expect(store().atlases[0].regions).toHaveLength(1);
  });

  it("zoom label follows the scale; Ajustar restores fit scale", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: true });
    await mountEditor(pid, atlas.id);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    });
    expect(screen.getByText("125%")).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    });
    expect(screen.getByText("100%")).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Fit to screen" }));
    });
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("delete-atlas in the header is two-step and exits to the index", async () => {
    const pid = seedProject();
    const atlas = seedAtlas(pid, { withMap: true });
    await mountEditor(pid, atlas.id);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Delete atlas" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Delete atlas" }));
    });
    await waitFor(() => {
      expect(store().atlases).toHaveLength(0);
    });
    expect(store().toasts.some((t) => t.message === "Atlas deleted.")).toBe(true);
    expect(screen.getByText("No saved atlases found. Create a new one first!")).toBeTruthy();
  });
});
