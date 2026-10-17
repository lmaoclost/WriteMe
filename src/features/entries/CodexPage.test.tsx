import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";
import type { EntryCategory, WorldEntry } from "../../domain/types";

type EntrySpec = { title: string; category: EntryCategory; body?: string };

function seedProject(specs: EntrySpec[]): string {
  const project = useScriptorium.getState().addProject("Vellmora");
  for (const spec of specs) {
    const entry = useScriptorium.getState().addEntry(project.id, spec.category);
    useScriptorium.getState().updateEntry(entry.id, {
      title: spec.title,
      ...(spec.body !== undefined ? { body: spec.body } : {}),
    });
  }
  return project.id;
}

function codexRoute(projectId: string, state?: { select?: string }) {
  return (
    <MemoryRouter
      initialEntries={[state ? { pathname: `/p/${projectId}/entries`, state } : `/p/${projectId}/entries`]}
    >
      <AppRouter />
    </MemoryRouter>
  );
}

function entryOf(title: string) {
  const entry = useScriptorium.getState().entries.find((e) => e.title === title);
  expect(entry, `entry ${title} should exist`).toBeTruthy();
  return entry as NonNullable<typeof entry>;
}

function projectEntries(projectId: string) {
  return useScriptorium.getState().entries.filter((e) => e.projectId === projectId);
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CodexPage", () => {
  it("lists entries with category dots and activates the first by default", () => {
    const projectId = seedProject([
      { title: "Cidade de Vellmora", category: "place" },
      { title: "Aldric Vellmor", category: "person" },
    ]);
    render(codexRoute(projectId));
    const city = screen.getByRole("button", { name: "Cidade de Vellmora" });
    const aldric = screen.getByRole("button", { name: "Aldric Vellmor" });
    const cityDot = city.querySelector(".codex-dot");
    const aldricDot = aldric.querySelector(".codex-dot");
    expect(cityDot).toHaveStyle({ backgroundColor: "#4d6f8f" });
    expect(aldricDot).toHaveStyle({ backgroundColor: "#e74c3c" });
    expect(city).toHaveClass("active");
    expect(aldric).not.toHaveClass("active");
    expect(within(city).getByText("Cidade de Vellmora")).toBeInTheDocument();
  });

  it("filters by category chips with aria-pressed state", () => {
    const projectId = seedProject([
      { title: "Cidade de Vellmora", category: "place" },
      { title: "Aldric Vellmor", category: "person" },
      { title: "Lei do Selo", category: "lore" },
    ]);
    render(codexRoute(projectId));
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Characters" }));
    expect(screen.queryByRole("button", { name: "Cidade de Vellmora" })).toBeNull();
    expect(screen.getByRole("button", { name: "Aldric Vellmor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Characters" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Todas" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(screen.getByRole("button", { name: "Lei do Selo" })).toBeInTheDocument();
  });

  it("searches titles case-insensitively, trimmed, and shows no-result copy", () => {
    const projectId = seedProject([
      { title: "Cidade de Vellmora", category: "place" },
      { title: "Rio Sarnen", category: "place" },
    ]);
    render(codexRoute(projectId));
    fireEvent.change(screen.getByLabelText("Search entries"), { target: { value: "  sARNen " } });
    expect(screen.queryByRole("button", { name: "Cidade de Vellmora" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rio Sarnen" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search entries"), { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhum resultado.")).toBeInTheDocument();
  });

  it("combines the category chip and the search filters", () => {
    const projectId = seedProject([
      { title: "Cidade de Vellmora", category: "place" },
      { title: "Rio Sarnen", category: "place" },
      { title: "Aldric Vellmor", category: "person" },
    ]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Characters" }));
    fireEvent.change(screen.getByLabelText("Search entries"), { target: { value: "sarnen" } });
    expect(screen.getByText("Nenhum resultado.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(screen.getByRole("button", { name: "Rio Sarnen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cidade de Vellmora" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aldric Vellmor" })).toBeNull();
  });

  it("create selects the new entry and focuses its title", () => {
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place" }]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "New entry" }));
    const created = projectEntries(projectId).find((e) => e.title === "Untitled entry");
    expect(created).toBeTruthy();
    expect(created?.category).toBe("lore");
    expect(created).toBe(projectEntries(projectId).at(-1));
    expect(screen.getByLabelText("Title")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Untitled entry" })).toHaveClass("active");
  });

  it("shows the empty codex copy when there are no entries", () => {
    const projectId = seedProject([]);
    render(codexRoute(projectId));
    expect(screen.getByText("The codex is empty — register the first entry.")).toBeInTheDocument();
  });

  it("deletes with two-step confirm, toast and first-remaining selection", () => {
    const projectId = seedProject([
      { title: "Cidade de Vellmora", category: "place" },
      { title: "Aldric Vellmor", category: "person" },
      { title: "Lei do Selo", category: "lore" },
    ]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Lei do Selo" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Lei do Selo");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Confirm?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    expect(screen.queryByRole("button", { name: "Lei do Selo" })).toBeNull();
    expect(projectEntries(projectId).map((e) => e.title)).toEqual(
      ["Cidade de Vellmora", "Aldric Vellmor"],
    );
    expect(useScriptorium.getState().toasts.some((t) => t.message === "Entry deleted.")).toBe(true);
    expect(screen.getByRole("button", { name: "Cidade de Vellmora" })).toHaveClass("active");
    expect(screen.getByLabelText("Title")).toHaveValue("Cidade de Vellmora");
  });

  it("resets the delete confirmation after 3s", () => {
    vi.useFakeTimers();
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place" }]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("button", { name: "Confirm?" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("falls back to no selection when the last entry is deleted", () => {
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place" }]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cidade de Vellmora" })).toBeNull();
    expect(screen.getByText("The codex is empty — register the first entry.")).toBeInTheDocument();
  });

  it("selects the route state entry once and clears history state", () => {
    const projectId = seedProject([
      { title: "Cidade de Vellmora", category: "place" },
      { title: "Rio Sarnen", category: "place" },
    ]);
    const rio = entryOf("Rio Sarnen");
    window.history.replaceState({ key: "k1", idx: 2, usr: { foo: 1 } }, "");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    render(codexRoute(projectId, { select: rio.id }));
    expect(screen.getByRole("button", { name: "Rio Sarnen" })).toHaveClass("active");
    expect(screen.getByLabelText("Title")).toHaveValue("Rio Sarnen");
    expect(replaceSpy).toHaveBeenCalledWith({ key: "k1", idx: 2, usr: null }, "");
    expect(window.history.state).toEqual({ key: "k1", idx: 2, usr: null });
    fireEvent.click(screen.getByRole("button", { name: "Cidade de Vellmora" }));
    expect(screen.getByRole("button", { name: "Cidade de Vellmora" })).toHaveClass("active");
  });

  it("keeps navigation intact after consuming the select state", () => {
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place" }]);
    const city = entryOf("Cidade de Vellmora");
    function NavButtons() {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate("/")}>go home</button>
          <button onClick={() => navigate(-1)}>go back</button>
        </>
      );
    }
    render(
      <MemoryRouter
        initialEntries={[{ pathname: `/p/${projectId}/entries`, state: { select: city.id } }]}
      >
        <NavButtons />
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Cidade de Vellmora");
    fireEvent.click(screen.getByRole("button", { name: "go home" }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "go back" }));
    expect(screen.getByRole("button", { name: "Cidade de Vellmora" })).toHaveClass("active");
    expect(screen.getByLabelText("Title")).toHaveValue("Cidade de Vellmora");
  });

  it("ignores route state select for a missing entry", () => {
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place" }]);
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    render(codexRoute(projectId, { select: "ent_missing" }));
    expect(screen.getByRole("button", { name: "Cidade de Vellmora" })).toHaveClass("active");
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("commits title, category and body edits to the store", () => {
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place", body: "capital" }]);
    render(codexRoute(projectId));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Porto de Vellmora" } });
    fireEvent.blur(screen.getByLabelText("Title"));
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "faction" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Torres de pedra." } });
    fireEvent.blur(screen.getByLabelText("Content"));
    const [entry] = projectEntries(projectId);
    expect(entry.title).toBe("Porto de Vellmora");
    expect(entry.category).toBe("faction");
    expect(entry.body).toBe("Torres de pedra.");
  });

  it("does not leak a dirty draft into an entry with the same defaults", () => {
    vi.useFakeTimers();
    const projectId = seedProject([
      { title: "Untitled entry", category: "lore" },
      { title: "Untitled entry", category: "lore" },
    ]);
    render(codexRoute(projectId));
    const body = screen.getByLabelText("Content");
    fireEvent.change(body, { target: { value: "abc" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Untitled entry" })[1]);
    expect(screen.getByLabelText("Content")).toHaveValue("");
    const [a, b] = projectEntries(projectId);
    expect(a.body).toBe("abc");
    expect(b.body).toBe("");
    act(() => { vi.advanceTimersByTime(300); });
    expect(a.body).toBe("abc");
    expect(b.body).toBe("");
    vi.useRealTimers();
  });

  it("switches the right panel when another entry is selected", () => {
    const projectId = seedProject([
      { title: "Cidade de Vellmora", category: "place" },
      { title: "Rio Sarnen", category: "place" },
    ]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Rio Sarnen" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Rio Sarnen");
  });

  it("renders the cover image when the entry has one", () => {
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place" }]);
    const key = useScriptorium.getState().putImage("data:image/png;base64,COVER", "entry");
    useScriptorium.getState().updateEntry(projectEntries(projectId)[0].id, { imageKey: key });
    render(codexRoute(projectId));
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/png;base64,COVER");
  });
});

describe("entries route wiring", () => {
  it("renders the codex page instead of the placeholder", () => {
    const projectId = seedProject([]);
    render(codexRoute(projectId));
    expect(screen.getByRole("button", { name: "New entry" })).toBeInTheDocument();
    expect(screen.queryByText(/sub-projeto 3/i)).not.toBeInTheDocument();
  });

  it("opens straight into the linked entry via ?e=", () => {
    const projectId = seedProject([
      { title: "Rio Sarnen", category: "place" },
      { title: "Guerra dos Cinco Invernos", category: "event" },
    ]);
    const war = projectEntries(projectId).find((e) => e.title === "Guerra dos Cinco Invernos")!.id;
    render(
      <MemoryRouter initialEntries={[`/p/${projectId}/entries?e=${war}`]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Guerra dos Cinco Invernos");
  });
});

describe("CodexPage — sections and summary (codex-15)", () => {
  beforeEach(() => {
    localStorage.clear();
    useScriptorium.setState(useScriptorium.getInitialState());
  });

  it("new character entry comes with template sections pre-created", () => {
    const pid = useScriptorium.getState().addProject("V").id;
    let entry: WorldEntry;
    act(() => { entry = useScriptorium.getState().addEntry(pid, "character"); });
    const e = entry!;
    expect(e.sections?.length).toBeGreaterThan(0);
    const labels = e.sections!.flatMap((s) => s.fields.map((f) => f.label));
    expect(labels).toContain("Identity");
    expect(labels).toContain("Appearance");
  });

  it("summary toggle edits and persists", () => {
    vi.useFakeTimers();
    const pid = useScriptorium.getState().addProject("V").id;
    act(() => { useScriptorium.getState().addEntry(pid, "lore"); });
    render(codexRoute(pid));
    fireEvent.click(screen.getByRole("button", { name: /Summary/ }));
    const inp = screen.getByLabelText("Summary");
    fireEvent.change(inp, { target: { value: "Uma lei rígida." } });
    act(() => vi.advanceTimersByTime(320));
    expect(useScriptorium.getState().entries[0].summary).toBe("Uma lei rígida.");
    vi.useRealTimers();
  });

  it("field content commits debounced into sections", async () => {
    vi.useFakeTimers();
    const pid = useScriptorium.getState().addProject("V").id;
    const e = useScriptorium.getState().addEntry(pid, "character");
    if (!e) throw new Error("addEntry falhou");
    render(codexRoute(pid));
    const inp = screen.getByLabelText("Identity");
    fireEvent.change(inp, { target: { value: "31 anos, humana" } });
    act(() => vi.advanceTimersByTime(320));
    const sec = useScriptorium.getState().entries.find((x) => x.id === e.id)!.sections!;
    expect(sec.flatMap((s) => s.fields.map((f) => f.content))).toContain("31 anos, humana");
    vi.useRealTimers();
  });
});

describe("CodexPage — cover framing, summary presentation, custom kinds", () => {
  beforeEach(() => {
    localStorage.clear();
    useScriptorium.setState(useScriptorium.getInitialState());
  });

  it("cover respects the saved focal point; dragging the cover sets it", () => {
    const pid = useScriptorium.getState().addProject("V").id;
    const e = useScriptorium.getState().addEntry(pid, "place")!;
    useScriptorium.getState().putEntryImage(e.id, "data:image/svg+xml,%3Csvg/%3E");
    useScriptorium.getState().updateEntry(e.id, { focal: [0.25, 0.7] });
    render(codexRoute(pid));
    const cover = screen.getByAltText(`Cover of ${e.title}`) as HTMLElement;
    expect(cover.style.objectPosition).toBe("25% 70%");
    // drag from the top edge to the bottom edge → focal follows the pointer
    const rect = cover.getBoundingClientRect();
    Object.defineProperty(cover, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
    });
    void rect;
    const fire = (type: string, x: number, y: number) => {
      const ev = new Event(type, { bubbles: true });
      Object.defineProperties(ev, { clientX: { value: x }, clientY: { value: y }, pointerId: { value: 1 }, pointerType: { value: "mouse" }, button: { value: 0 }, buttons: { value: 1 }, isPrimary: { value: true } });
      cover.dispatchEvent(ev);
    };
    act(() => {
      fire("pointerdown", 100, 10);
      fire("pointermove", 100, 90);
      fire("pointermove", 100, 120);
      fire("pointerup", 100, 120);
    });
    const saved = useScriptorium.getState().entries.find((x) => x.id === e.id)!;
    expect(saved.focal).toEqual([0.5, 1]);
    expect(cover.style.objectPosition).toBe("50% 100%");
  });

  it("user-created entry kinds join the chips, the selector and persist", () => {
    const pid = useScriptorium.getState().addProject("V").id;
    useScriptorium.getState().addEntry(pid, "lore");
    render(codexRoute(pid));
    fireEvent.click(screen.getByRole("button", { name: /new kind/i }));
    fireEvent.change(screen.getByLabelText("Kind name"), { target: { value: "Religion" } });
    fireEvent.change(screen.getByLabelText("Kind emoji"), { target: { value: "🕯️" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create kind$/i }));
    const proj = useScriptorium.getState().projects.find((p) => p.id === pid)!;
    const kind = proj.customCategories?.[0];
    expect(kind).toMatchObject({ key: "religion", label: "Religion", icon: "🕯️" });
    // chip filter includes the new kind
    expect(screen.getByTitle("Religion")).toBeInTheDocument();
    // the category selector offers it
    const cat = screen.getByLabelText("Category") as HTMLSelectElement;
    const opts = Array.from(cat.options).map((o) => ({ v: o.value, t: o.textContent }));
    expect(opts.some((o) => o.v === "religion" && o.t?.includes("Religion"))).toBe(true);
    // assigning the kind persists (schema accepts it)
    fireEvent.change(cat, { target: { value: "religion" } });
    expect(useScriptorium.getState().entries[0].category).toBe("religion");
  });

  it("summary block presents the filled blurb as content, not as a prompt", () => {
    const pid = useScriptorium.getState().addProject("V").id;
    const e = useScriptorium.getState().addEntry(pid, "lore")!;
    useScriptorium.getState().updateEntry(e.id, { summary: "O aviso do rio." });
    render(codexRoute(pid));
    const toggle = screen.getByText("O aviso do rio.").closest("button")!;
    expect(toggle.className).toContain("filled"); // styled differently when non-empty
    expect(toggle.textContent).not.toContain("Add a short blurb");
    void pid;
  });
});
