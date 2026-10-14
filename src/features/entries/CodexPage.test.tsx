import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";
import type { EntryCategory } from "../../domain/types";

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
    fireEvent.change(screen.getByLabelText("Buscar entrada…"), { target: { value: "  sARNen " } });
    expect(screen.queryByRole("button", { name: "Cidade de Vellmora" })).toBeNull();
    expect(screen.getByRole("button", { name: "Rio Sarnen" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar entrada…"), { target: { value: "inexistente" } });
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
    fireEvent.change(screen.getByLabelText("Buscar entrada…"), { target: { value: "sarnen" } });
    expect(screen.getByText("Nenhum resultado.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(screen.getByRole("button", { name: "Rio Sarnen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cidade de Vellmora" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Aldric Vellmor" })).toBeNull();
  });

  it("create selects the new entry and focuses its title", () => {
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place" }]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: /nova entrada/i }));
    const created = projectEntries(projectId).find((e) => e.title === "Sem título");
    expect(created).toBeTruthy();
    expect(created?.category).toBe("lore");
    expect(created).toBe(projectEntries(projectId).at(-1));
    expect(screen.getByLabelText("Título")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Sem título" })).toHaveClass("active");
  });

  it("shows the empty codex copy when there are no entries", () => {
    const projectId = seedProject([]);
    render(codexRoute(projectId));
    expect(screen.getByText("O códex está vazio — registre a primeira entrada.")).toBeInTheDocument();
  });

  it("deletes with two-step confirm, toast and first-remaining selection", () => {
    const projectId = seedProject([
      { title: "Cidade de Vellmora", category: "place" },
      { title: "Aldric Vellmor", category: "person" },
      { title: "Lei do Selo", category: "lore" },
    ]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Lei do Selo" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Lei do Selo");
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(screen.getByRole("button", { name: "Confirmar?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar?" }));
    expect(screen.queryByRole("button", { name: "Lei do Selo" })).toBeNull();
    expect(projectEntries(projectId).map((e) => e.title)).toEqual(
      ["Cidade de Vellmora", "Aldric Vellmor"],
    );
    expect(useScriptorium.getState().toasts.some((t) => t.message === "Entrada excluída.")).toBe(true);
    expect(screen.getByRole("button", { name: "Cidade de Vellmora" })).toHaveClass("active");
    expect(screen.getByLabelText("Título")).toHaveValue("Cidade de Vellmora");
  });

  it("resets the delete confirmation after 3s", () => {
    vi.useFakeTimers();
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place" }]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(screen.getByRole("button", { name: "Confirmar?" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("falls back to no selection when the last entry is deleted", () => {
    const projectId = seedProject([{ title: "Cidade de Vellmora", category: "place" }]);
    render(codexRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar?" }));
    expect(screen.queryByLabelText("Título")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cidade de Vellmora" })).toBeNull();
    expect(screen.getByText("O códex está vazio — registre a primeira entrada.")).toBeInTheDocument();
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
    expect(screen.getByLabelText("Título")).toHaveValue("Rio Sarnen");
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
    expect(screen.getByLabelText("Título")).toHaveValue("Cidade de Vellmora");
    fireEvent.click(screen.getByRole("button", { name: "go home" }));
    expect(screen.getByRole("heading", { name: "Scriptorium" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "go back" }));
    expect(screen.getByRole("button", { name: "Cidade de Vellmora" })).toHaveClass("active");
    expect(screen.getByLabelText("Título")).toHaveValue("Cidade de Vellmora");
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
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Porto de Vellmora" } });
    fireEvent.blur(screen.getByLabelText("Título"));
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "faction" } });
    fireEvent.change(screen.getByLabelText("Conteúdo"), { target: { value: "Torres de pedra." } });
    fireEvent.blur(screen.getByLabelText("Conteúdo"));
    const [entry] = projectEntries(projectId);
    expect(entry.title).toBe("Porto de Vellmora");
    expect(entry.category).toBe("faction");
    expect(entry.body).toBe("Torres de pedra.");
  });

  it("does not leak a dirty draft into an entry with the same defaults", () => {
    vi.useFakeTimers();
    const projectId = seedProject([
      { title: "Sem título", category: "lore" },
      { title: "Sem título", category: "lore" },
    ]);
    render(codexRoute(projectId));
    const body = screen.getByLabelText("Conteúdo");
    fireEvent.change(body, { target: { value: "abc" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Sem título" })[1]);
    expect(screen.getByLabelText("Conteúdo")).toHaveValue("");
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
    expect(screen.getByLabelText("Título")).toHaveValue("Rio Sarnen");
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
    expect(screen.getByRole("button", { name: /nova entrada/i })).toBeInTheDocument();
    expect(screen.queryByText(/sub-projeto 3/i)).not.toBeInTheDocument();
  });
});
