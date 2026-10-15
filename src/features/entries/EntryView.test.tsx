import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileToDataUrl } from "../../data/image";
import { useScriptorium } from "../../data/store";
import type { EntryCategory, WorldEntry } from "../../domain/types";
import { EntryView } from "./EntryView";

vi.mock("../../data/image", () => ({
  fileToDataUrl: vi.fn(async () => ({ dataUrl: "data:image/png;base64,NOVA", keptPng: true })),
}));

const store = () => useScriptorium.getState();

type Spec = { title: string; category?: EntryCategory; body?: string; image?: string; date?: string };

function seed(specs: Spec[]): { projectId: string; entries: WorldEntry[] } {
  const project = store().addProject("Vellmora");
  const entries = specs.map((spec) => {
    const entry = store().addEntry(project.id, spec.category ?? "lore");
    store().updateEntry(entry.id, {
      title: spec.title,
      ...(spec.body !== undefined ? { body: spec.body } : {}),
      ...(spec.image !== undefined
        ? { imageKey: store().putImage(spec.image, "entry") }
        : {}),
      ...(spec.date !== undefined ? { date: spec.date } : {}),
    });
    return entryById(entry.id);
  });
  return { projectId: project.id, entries };
}

function LiveEntryView({ id, onDeleted, onSelectEntry }: { id: string; onDeleted(id: string): void; onSelectEntry?(id: string): void }) {
  const entry = useScriptorium((s) => s.entries.find((e) => e.id === id));
  if (!entry) return null;
  return <EntryView entry={entry} onDeleted={onDeleted} onSelectEntry={onSelectEntry} />;
}

function renderView(entry: WorldEntry, handlers: { onDeleted?: (id: string) => void; onSelectEntry?: (id: string) => void } = {}) {
  const onDeleted = handlers.onDeleted ?? vi.fn();
  const onSelectEntry = handlers.onSelectEntry ?? vi.fn();
  const result = render(
    <MemoryRouter>
      <LiveEntryView id={entry.id} onDeleted={onDeleted} onSelectEntry={onSelectEntry} />
    </MemoryRouter>,
  );
  return { onDeleted, onSelectEntry, unmount: () => { if (!result.container.isConnected) return; result.unmount(); } };
}

function entryById(id: string): WorldEntry {
  const entry = useScriptorium.getState().entries.find((e) => e.id === id);
  expect(entry, `entry ${id} should exist`).toBeTruthy();
  return entry as WorldEntry;
}

function toasts() {
  return useScriptorium.getState().toasts;
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("EntryView — debounced commits", () => {
  it("commits title and body after 300ms, not before (fake timers)", () => {
    vi.useFakeTimers();
    const { entries } = seed([{ title: "Aldric", body: "Velho corpo" }]);
    const [entry] = entries;
    renderView(entry);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Aldric II" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Novo corpo" } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(entryById(entry.id).title).toBe("Aldric");
    expect(entryById(entry.id).body).toBe("Velho corpo");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(entryById(entry.id).title).toBe("Aldric II");
    expect(entryById(entry.id).body).toBe("Novo corpo");
  });

  it("flushes the pending draft on blur", () => {
    const { entries } = seed([{ title: "Aldric", body: "" }]);
    const [entry] = entries;
    renderView(entry);
    const body = screen.getByLabelText("Content");
    fireEvent.change(body, { target: { value: "Rascunho no blur" } });
    expect(entryById(entry.id).body).toBe("");
    fireEvent.blur(body);
    expect(entryById(entry.id).body).toBe("Rascunho no blur");
  });

  it("flushes the pending draft on unmount (no lost keystroke)", () => {
    const { entries } = seed([{ title: "Aldric", body: "" }]);
    const [entry] = entries;
    const { unmount } = renderView(entry);
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Rascunho perdido?" } });
    unmount();
    expect(entryById(entry.id).body).toBe("Rascunho perdido?");
  });

  it("flushes the pending draft for the PREVIOUS entry when switching entries", () => {
    const { entries } = seed([
      { title: "Aldric", body: "" },
      { title: "Rio Sarnen", body: "" },
    ]);
    const [aldric, rio] = entries;
    const { rerender } = render(
      <MemoryRouter>
        <EntryView entry={aldric} onDeleted={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Corpo do Aldric" } });
    rerender(
      <MemoryRouter>
        <EntryView entry={rio} onDeleted={vi.fn()} />
      </MemoryRouter>,
    );
    expect(entryById(aldric.id).body).toBe("Corpo do Aldric");
    expect(screen.getByLabelText("Title")).toHaveValue("Rio Sarnen");
  });
});

describe("EntryView — Write/Preview", () => {
  it("toggles between textarea and markdown preview (aria-pressed pair)", () => {
    const { entries } = seed([{ title: "Aldric", body: "# Capítulo\n**força** e `código`" }]);
    const [entry] = entries;
    renderView(entry);
    const escrever = screen.getByRole("button", { name: "Write" });
    const previa = screen.getByRole("button", { name: "Preview" });
    expect(escrever).toHaveAttribute("aria-pressed", "true");
    expect(previa).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Content").tagName).toBe("TEXTAREA");
    fireEvent.click(previa);
    expect(previa).toHaveAttribute("aria-pressed", "true");
    expect(escrever).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByLabelText("Content")).toBeNull();
    const view = document.querySelector(".md-view");
    expect(view).not.toBeNull();
    expect(view?.querySelector("h1")?.textContent).toBe("Capítulo");
    expect(view?.querySelector("strong")?.textContent).toBe("força");
    expect(view?.querySelector("code")?.textContent).toBe("código");
    fireEvent.click(escrever);
    expect(screen.getByLabelText("Content")).toHaveValue("# Capítulo\n**força** e `código`");
  });

  it("renders the preview from the flushed draft", () => {
    const { entries } = seed([{ title: "Aldric", body: "" }]);
    const [entry] = entries;
    renderView(entry);
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "# Novo rascunho" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(entryById(entry.id).body).toBe("# Novo rascunho");
    expect(document.querySelector(".md-view")?.querySelector("h1")?.textContent).toBe("Novo rascunho");
  });

  it("shows placeholder copy when the preview body is empty", () => {
    const { entries } = seed([{ title: "Aldric", body: "" }]);
    const [entry] = entries;
    renderView(entry);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("No content yet.")).toBeInTheDocument();
  });
});

describe("EntryView — category + cover", () => {
  it("commits the category select directly", () => {
    const { entries } = seed([{ title: "Aldric", category: "person" }]);
    const [entry] = entries;
    renderView(entry);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "faction" } });
    expect(entryById(entry.id).category).toBe("faction");
    expect(screen.getByLabelText("Category")).toHaveValue("faction");
  });

  it("uploads a cover via hidden file input, swaps and releases the old key", async () => {
    const { entries } = seed([{ title: "Aldric", image: "data:image/jpeg;base64,VELHA" }]);
    const [entry] = entries;
    const oldKey = entryById(entry.id).imageKey as string;
    renderView(entry);
    const input = document.querySelector('input[type="file"].visually-hidden') as HTMLInputElement;
    expect(input).not.toBeNull();
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["x"], "capa.png", { type: "image/png" })] } });
    });
    await waitFor(() => {
      expect(entryById(entry.id).imageKey).toBeTruthy();
      expect(entryById(entry.id).imageKey).not.toBe(oldKey);
    });
    const newKey = entryById(entry.id).imageKey as string;
    expect(useScriptorium.getState().images[newKey]).toBe("data:image/png;base64,NOVA");
    expect(useScriptorium.getState().images[oldKey]).toBeUndefined();
    expect(toasts().some((t) => t.kind === "success" && t.message === "Cover updated.")).toBe(true);
    expect(vi.mocked(fileToDataUrl)).toHaveBeenCalledTimes(1);
  });

  it("toasts an error when the cover upload fails", async () => {
    vi.mocked(fileToDataUrl).mockRejectedValueOnce(new Error("boom"));
    const { entries } = seed([{ title: "Aldric" }]);
    const [entry] = entries;
    renderView(entry);
    const input = document.querySelector('input[type="file"].visually-hidden') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["x"], "capa.png", { type: "image/png" })] } });
    });
    await waitFor(() => {
      expect(toasts().some((t) => t.kind === "error" && t.message === "Couldn't load the cover.")).toBe(true);
    });
    expect(entryById(entry.id).imageKey).toBeUndefined();
  });

  it("removes the cover: releases the image and clears the key", () => {
    const { entries } = seed([{ title: "Aldric", image: "data:image/jpeg;base64,VELHA" }]);
    const [entry] = entries;
    const key = entryById(entry.id).imageKey as string;
    renderView(entry);
    fireEvent.click(screen.getByRole("button", { name: "Remove cover" }));
    expect(entryById(entry.id).imageKey).toBeUndefined();
    expect(useScriptorium.getState().images[key]).toBeUndefined();
  });

  it("copies another entry's image as this cover via 'Entry image'", () => {
    const { entries } = seed([
      { title: "Aldric", image: "data:image/jpeg;base64,VELHA" },
      { title: "Rio Sarnen", image: "data:image/jpeg;base64,OUTRO" },
      { title: "Lei do Selo" },
    ]);
    const [aldric, rio, lei] = entries;
    const rioKey = entryById(rio.id).imageKey as string;
    const oldKey = entryById(aldric.id).imageKey as string;
    renderView(aldric);
    fireEvent.click(screen.getByRole("button", { name: "Entry image" }));
    const picker = screen.getByRole("group", { name: "Entry images" });
    expect(picker.querySelectorAll(".codex-thumbgrid button")).toHaveLength(1);
    const thumb = picker.querySelector(".codex-thumbgrid img");
    expect(thumb).not.toBeNull();
    expect(thumb).toHaveAttribute("src", "data:image/jpeg;base64,OUTRO");
    fireEvent.click(screen.getByRole("button", { name: /rio sarnen/i }));
    const newKey = entryById(aldric.id).imageKey as string;
    expect(newKey).toBeTruthy();
    expect(newKey).not.toBe(rioKey);
    expect(newKey).not.toBe(oldKey);
    expect(useScriptorium.getState().images[newKey]).toBe("data:image/jpeg;base64,OUTRO");
    expect(entryById(rio.id).imageKey).toBe(rioKey);
    expect(useScriptorium.getState().images[oldKey]).toBeUndefined();
    expect(entryById(lei.id).imageKey).toBeUndefined();
  });
});

describe("EntryView — links", () => {
  it("adds a link through the entry chooser popover", () => {
    const { entries } = seed([
      { title: "Aldric" },
      { title: "Rio Sarnen" },
      { title: "Lei do Selo" },
    ]);
    const [aldric, rio] = entries;
    renderView(aldric);
    fireEvent.click(screen.getByRole("button", { name: "+ Link" }));
    const search = screen.getByLabelText("Buscar entrada");
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("Nenhum resultado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rio Sarnen" })).toBeNull();
    fireEvent.change(search, { target: { value: "rio" } });
    fireEvent.click(screen.getByRole("button", { name: "Rio Sarnen" }));
    expect(entryById(aldric.id).links).toEqual([rio.id]);
    expect(screen.queryByLabelText("Buscar entrada")).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Link" })).not.toBeNull();
  });

  it("does not offer the current entry as its own link target", () => {
    const { entries } = seed([{ title: "Aldric" }]);
    const [aldric] = entries;
    renderView(aldric);
    fireEvent.click(screen.getByRole("button", { name: "+ Link" }));
    expect(screen.queryByRole("button", { name: "Aldric" })).toBeNull();
    expect(entryById(aldric.id).links).toEqual([]);
  });

  it("unlinks via the chip ✕ and selects via the chip title", () => {
    const { entries } = seed([{ title: "Aldric" }, { title: "Rio Sarnen" }]);
    const [aldric, rio] = entries;
    store().linkEntries(aldric.id, rio.id);
    const onSelectEntry = vi.fn();
    renderView(aldric, { onSelectEntry });
    const chip = document.querySelector(".codex-link-chip");
    expect(chip).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Rio Sarnen" })[0]).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Rio Sarnen" })[0]);
    expect(onSelectEntry).toHaveBeenCalledWith(rio.id);
    expect(entryById(aldric.id).links).toEqual([rio.id]);
    fireEvent.click(screen.getByLabelText("Unlink Rio Sarnen"));
    expect(entryById(aldric.id).links).toEqual([]);
    expect(document.querySelector(".codex-link-chip")).toBeNull();
  });

  it("deleting the entry cleans reverse links elsewhere (store via onDeleted)", () => {
    const { entries } = seed([{ title: "Aldric" }, { title: "Rio Sarnen" }]);
    const [aldric, rio] = entries;
    store().linkEntries(aldric.id, rio.id);
    const onDeleted = vi.fn((id: string) => store().deleteEntry(id));
    renderView(aldric, { onDeleted });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    expect(onDeleted).toHaveBeenCalledWith(aldric.id);
    expect(entryById(rio.id).links).toEqual([]);
  });
});

describe("EntryView — campo Data", () => {
  it("sits between the category select and the body textarea", () => {
    const { entries } = seed([{ title: "Batalha de Sarnen", category: "event" }]);
    const [entry] = entries;
    renderView(entry);
    const input = screen.getByLabelText("Date");
    expect(input.compareDocumentPosition(screen.getByLabelText("Category")) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(input.compareDocumentPosition(screen.getByLabelText("Content")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(entryById(entry.id).date).toBeUndefined();
  });

  it("commits a valid date after 300ms, not before (fake timers)", () => {
    vi.useFakeTimers();
    const { entries } = seed([{ title: "Batalha de Sarnen", category: "event" }]);
    const [entry] = entries;
    renderView(entry);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "1200-05" } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(entryById(entry.id).date).toBeUndefined();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(entryById(entry.id).date).toBe("1200-05");
  });

  it("does not persist an invalid date and shows the hint until fixed", () => {
    vi.useFakeTimers();
    const { entries } = seed([{ title: "Batalha de Sarnen", category: "event" }]);
    const [entry] = entries;
    renderView(entry);
    const input = screen.getByLabelText("Date");
    fireEvent.change(input, { target: { value: "1200-13" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(entryById(entry.id).date).toBeUndefined();
    expect(screen.getByText("Invalid date.")).toBeTruthy();
    fireEvent.change(input, { target: { value: "1200" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(entryById(entry.id).date).toBe("1200");
    expect(screen.queryByText("Invalid date.")).toBeNull();
  });

  it("clears the date when the field is emptied", () => {
    vi.useFakeTimers();
    const { entries } = seed([{ title: "Batalha de Sarnen", category: "event", date: "1200-05" }]);
    const [entry] = entries;
    renderView(entry);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(entryById(entry.id).date).toBeUndefined();
  });

  it("shows the formatted date as an eyebrow above the title when present", () => {
    const { entries } = seed([{ title: "Batalha de Sarnen", category: "event", date: "1200-05-06" }]);
    const [entry] = entries;
    renderView(entry);
    expect(document.querySelector(".codex-eyebrow")?.textContent).toBe("6 de Maio de 1200");
    // Corrupted stored dates render no eyebrow (sanitize fails).
    act(() => {
      store().updateEntry(entry.id, { date: "1200-13" });
    });
    expect(document.querySelector(".codex-eyebrow")).toBeNull();
  });

  it("flushes a pending date draft when switching entries", () => {
    const { entries } = seed([
      { title: "Batalha de Sarnen", category: "event" },
      { title: "Rio Sarnen" },
    ]);
    const [batalha, rio] = entries;
    const { rerender } = render(
      <MemoryRouter>
        <EntryView key={batalha.id} entry={batalha} onDeleted={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "1200-05" } });
    rerender(
      <MemoryRouter>
        <EntryView key={rio.id} entry={rio} onDeleted={vi.fn()} />
      </MemoryRouter>,
    );
    expect(entryById(batalha.id).date).toBe("1200-05");
    expect(screen.getByLabelText("Date")).toHaveValue("");
  });
});

describe("EntryView — pickers close (Escape + outside click)", () => {
  it("closes the codex image picker on Escape (document keydown)", () => {
    const { entries } = seed([{ title: "Aldric", image: "data:image/jpeg;base64,VELHA" }]);
    const [aldric] = entries;
    renderView(aldric);
    fireEvent.click(screen.getByRole("button", { name: "Entry image" }));
    expect(screen.getByRole("group", { name: "Entry images" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Entry images" })).toBeNull();
    expect(screen.getByRole("button", { name: "Entry image" })).toHaveAttribute("aria-pressed", "false");
  });

  it("closes the link chooser on Escape (document keydown)", () => {
    const { entries } = seed([{ title: "Aldric" }, { title: "Rio Sarnen" }]);
    const [aldric] = entries;
    renderView(aldric);
    fireEvent.click(screen.getByRole("button", { name: "+ Link" }));
    expect(screen.getByLabelText("Buscar entrada")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByLabelText("Buscar entrada")).toBeNull();
    expect(screen.getByRole("button", { name: "+ Link" })).toHaveAttribute("aria-pressed", "false");
  });

  it("closes the codex image picker on outside click (backdrop pointerdown)", () => {
    const { entries } = seed([{ title: "Aldric", image: "data:image/jpeg;base64,VELHA" }]);
    const [aldric] = entries;
    renderView(aldric);
    fireEvent.click(screen.getByRole("button", { name: "Entry image" }));
    const backdrop = document.querySelector(".chooser-backdrop") as Element;
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(backdrop);
    expect(screen.queryByRole("group", { name: "Entry images" })).toBeNull();
    expect(screen.getByRole("button", { name: "Entry image" })).toHaveAttribute("aria-pressed", "false");
  });

  it("closes the link chooser on outside click (backdrop pointerdown)", () => {
    const { entries } = seed([{ title: "Aldric" }, { title: "Rio Sarnen" }]);
    const [aldric] = entries;
    renderView(aldric);
    fireEvent.click(screen.getByRole("button", { name: "+ Link" }));
    const backdrop = document.querySelector(".chooser-backdrop") as Element;
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(backdrop);
    expect(screen.queryByLabelText("Buscar entrada")).toBeNull();
    expect(screen.getByRole("button", { name: "+ Link" })).toHaveAttribute("aria-pressed", "false");
  });
});
