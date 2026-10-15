import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";
import type { Manuscript } from "../../domain/types";

type BookSpec = {
  title?: string;
  author?: string;
  chapters?: { heading?: string; content?: string }[];
};

function seedProject(): string {
  return useScriptorium.getState().addProject("Vellmora").id;
}

function seedBook(projectId: string, spec: BookSpec = {}): Manuscript {
  const created = useScriptorium.getState().addManuscript(projectId, spec.title);
  if (spec.author) useScriptorium.getState().setManuscriptAuthor(created.id, spec.author);
  for (const ch of spec.chapters ?? []) {
    const chapter = useScriptorium.getState().addChapter(created.id, ch.heading);
    if (chapter && ch.content !== undefined) {
      useScriptorium.getState().updateChapter(chapter.id, { content: ch.content });
    }
  }
  const book = useScriptorium.getState().manuscripts.find((m) => m.id === created.id);
  expect(book, "seeded book should exist").toBeTruthy();
  return book as Manuscript;
}

function projectBooks(projectId: string): Manuscript[] {
  return useScriptorium.getState().manuscripts.filter((m) => m.projectId === projectId);
}

function bookOf(title: string): Manuscript {
  const book = useScriptorium.getState().manuscripts.find((m) => m.title === title);
  expect(book, `book ${title} should exist`).toBeTruthy();
  return book as Manuscript;
}

function manuscriptRoute(projectId: string) {
  return (
    <MemoryRouter initialEntries={[`/p/${projectId}/manuscript`]}>
      <AppRouter />
    </MemoryRouter>
  );
}

function rowHeadings() {
  const list = screen.getByRole("list", { name: "Capítulos" });
  return within(list)
    .getAllByRole("button", { name: /palavra/ })
    .map((row) => row.querySelector(".book-ch-heading")?.textContent);
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ManuscriptPage books", () => {
  it("renders the book page on the manuscript route, replacing the placeholder", () => {
    const projectId = seedProject();
    seedBook(projectId, { chapters: [{ heading: "Prólogo", content: "Uma noite." }] });
    render(manuscriptRoute(projectId));
    expect(screen.getByRole("button", { name: "Novo livro" })).toBeInTheDocument();
    expect(screen.queryByText(/sub-projeto 4/i)).not.toBeInTheDocument();
  });

  it("shows the empty-state copy and creates the first book", () => {
    const projectId = seedProject();
    render(manuscriptRoute(projectId));
    expect(screen.getByText("Comece o seu livro — crie o primeiro.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo livro" }));
    const books = projectBooks(projectId);
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Livro sem título");
    expect(books[0].author).toBe("");
    expect(screen.getByLabelText("Título do livro")).toHaveValue("Livro sem título");
  });

  it("auto-selects the single book, shows its title as a heading and opens its first chapter", () => {
    const projectId = seedProject();
    seedBook(projectId, {
      title: "Cantar de Vellmora",
      chapters: [{ heading: "Prólogo", content: "Uma noite." }],
    });
    render(manuscriptRoute(projectId));
    expect(screen.queryByLabelText("Livro")).toBeNull();
    expect(screen.getByRole("heading", { name: "Cantar de Vellmora" })).toBeInTheDocument();
    expect(screen.getByLabelText("Título do livro")).toHaveValue("Cantar de Vellmora");
    expect(screen.getByLabelText("Autor")).toHaveValue("");
    expect(screen.getByLabelText("Título do capítulo")).toHaveValue("Prólogo");
    expect(screen.getByRole("button", { name: /Prólogo/ })).toHaveClass("active");
  });

  it("selects among books when there are several and switches the editor", () => {
    const projectId = seedProject();
    const first = seedBook(projectId, {
      title: "Cantar de Vellmora",
      chapters: [{ heading: "Prólogo", content: "Uma noite." }],
    });
    seedBook(projectId, {
      title: "Segundo Livro",
      chapters: [{ heading: "Capítulo A", content: "Aqui." }],
    });
    render(manuscriptRoute(projectId));
    const select = screen.getByLabelText("Livro");
    expect(within(select).getAllByRole("option").map((o) => o.textContent))
      .toEqual(["Cantar de Vellmora", "Segundo Livro"]);
    expect(select).toHaveValue(first.id);
    fireEvent.change(select, { target: { value: bookOf("Segundo Livro").id } });
    expect(screen.queryByRole("heading", { name: "Cantar de Vellmora" })).toBeNull();
    expect(screen.getByLabelText("Título do livro")).toHaveValue("Segundo Livro");
    expect(screen.getByLabelText("Título do capítulo")).toHaveValue("Capítulo A");
  });

  it("commits book title and author edits debounced and on blur, updating the heading", () => {
    vi.useFakeTimers();
    const projectId = seedProject();
    seedBook(projectId, { title: "Cantar", author: "Renan" });
    render(manuscriptRoute(projectId));
    fireEvent.change(screen.getByLabelText("Título do livro"), { target: { value: "Cantar Completo" } });
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Outro" } });
    expect(projectBooks(projectId)[0].title).toBe("Cantar");
    expect(projectBooks(projectId)[0].author).toBe("Renan");
    expect(screen.getByRole("heading", { name: "Cantar" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(projectBooks(projectId)[0].title).toBe("Cantar Completo");
    expect(projectBooks(projectId)[0].author).toBe("Outro");
    expect(screen.getByRole("heading", { name: "Cantar Completo" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Autor"), { target: { value: "Nova" } });
    fireEvent.blur(screen.getByLabelText("Autor"));
    expect(projectBooks(projectId)[0].author).toBe("Nova");
  });

  it("does not leak a dirty book title draft when switching books", () => {
    vi.useFakeTimers();
    const projectId = seedProject();
    seedBook(projectId, { title: "A" });
    seedBook(projectId, { title: "B" });
    render(manuscriptRoute(projectId));
    fireEvent.change(screen.getByLabelText("Título do livro"), { target: { value: "A editado" } });
    fireEvent.change(screen.getByLabelText("Livro"), { target: { value: bookOf("B").id } });
    expect(screen.getByLabelText("Título do livro")).toHaveValue("B");
    expect(projectBooks(projectId).find((m) => m.title === "A editado")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(bookOf("B").title).toBe("B");
    vi.useRealTimers();
  });

  it("deletes the selected book with a two-step confirm and selects the first remaining, then none", () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um" }] });
    const second = seedBook(projectId, { title: "B", chapters: [{ heading: "Dois" }] });
    render(manuscriptRoute(projectId));
    fireEvent.change(screen.getByLabelText("Livro"), { target: { value: second.id } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir livro" }));
    expect(screen.getByRole("button", { name: "Confirmar?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar?" }));
    expect(projectBooks(projectId).map((m) => m.title)).toEqual(["A"]);
    expect(screen.getByLabelText("Título do livro")).toHaveValue("A");
    fireEvent.click(screen.getByRole("button", { name: "Excluir livro" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar?" }));
    expect(projectBooks(projectId)).toHaveLength(0);
    expect(screen.getByText("Comece o seu livro — crie o primeiro.")).toBeInTheDocument();
  });

  it("resets the book delete confirmation after 3s", () => {
    vi.useFakeTimers();
    const projectId = seedProject();
    seedBook(projectId, { title: "A" });
    render(manuscriptRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Excluir livro" }));
    expect(screen.getByRole("button", { name: "Confirmar?" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("button", { name: "Excluir livro" })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("ManuscriptPage chapters", () => {
  it("creates a chapter, selects it and focuses the heading", () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A" });
    render(manuscriptRoute(projectId));
    expect(screen.getByText("Adicione o primeiro capítulo.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo capítulo" }));
    const chapters = bookOf("A").chapters;
    expect(chapters).toHaveLength(1);
    expect(chapters[0].heading).toBe("Capítulo sem título");
    expect(chapters[0].order).toBe(0);
    expect(screen.getByLabelText("Título do capítulo")).toHaveFocus();
    expect(screen.getByRole("button", { name: /Capítulo sem título/ })).toHaveClass("active");
    expect(screen.queryByText("Adicione o primeiro capítulo.")).toBeNull();
  });

  it("lists chapters in order, disables edge arrows and swaps orders on move", () => {
    const projectId = seedProject();
    seedBook(projectId, {
      title: "A",
      chapters: [
        { heading: "Início", content: "um" },
        { heading: "Meio", content: "um dois" },
        { heading: "Fim", content: "um dois três" },
      ],
    });
    render(manuscriptRoute(projectId));
    expect(rowHeadings()).toEqual(["Início", "Meio", "Fim"]);
    const list = screen.getByRole("list", { name: "Capítulos" });
    const upButtons = within(list).getAllByRole("button", { name: "Reordenar capítulo acima" });
    const downButtons = within(list).getAllByRole("button", { name: "Reordenar capítulo abaixo" });
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[2]).toBeDisabled();
    expect(upButtons[1]).toBeEnabled();
    expect(downButtons[0]).toBeEnabled();
    fireEvent.click(downButtons[0]);
    expect(rowHeadings()).toEqual(["Meio", "Início", "Fim"]);
    const orders = Object.fromEntries(
      bookOf("A").chapters.map((c) => [c.heading, c.order]),
    );
    expect(orders).toEqual({ Início: 1, Meio: 0, Fim: 2 });
    expect(screen.getByRole("button", { name: /Início/ })).toHaveClass("active");
  });

  it("shows store wordcounts in rows and keeps the editor footer live from the draft", () => {
    vi.useFakeTimers();
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início", content: "um dois três" }] });
    render(manuscriptRoute(projectId));
    expect(screen.getByRole("button", { name: /Início/ }).textContent).toContain("3 palavras");
    // rich body: 6 words typed directly in the contenteditable (footer counts DOM)
    const richBody = () => document.querySelector('[data-testid="rich-body"]') as HTMLElement;
    richBody().textContent = "um dois três quatro mais uma";
    fireEvent.input(richBody());
    expect(screen.getByText("6 palavras")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Início/ }).textContent).toContain("3 palavras");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole("button", { name: /Início/ }).textContent).toContain("6 palavras");
    vi.useRealTimers();
  });

  it("commits chapter heading and body edits debounced and on blur", () => {
    vi.useFakeTimers();
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início", content: "" }] });
    render(manuscriptRoute(projectId));
    fireEvent.change(screen.getByLabelText("Título do capítulo"), { target: { value: "Chegada" } });
    const richBody = document.querySelector('[data-testid="rich-body"]') as HTMLElement;
    richBody.textContent = "Torres de pedra.";
    fireEvent.input(richBody);
    expect(bookOf("A").chapters[0]).toMatchObject({ heading: "Início", content: "" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(bookOf("A").chapters[0]).toMatchObject({ heading: "Chegada", content: "Torres de pedra." });
    fireEvent.change(screen.getByLabelText("Título do capítulo"), { target: { value: "Partida" } });
    fireEvent.blur(screen.getByLabelText("Título do capítulo"));
    expect(bookOf("A").chapters[0].heading).toBe("Partida");
    vi.useRealTimers();
  });

  it("flushes the draft when toggling to Prévia and renders the committed markdown", () => {
    vi.useFakeTimers();
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início", content: "" }] });
    render(manuscriptRoute(projectId));
    expect(screen.getByRole("button", { name: "Escrever" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Prévia" })).toHaveAttribute("aria-pressed", "false");
    // rich editor: blur commits whatever the body holds (markdown text survives
    // as text until the user applies rich formatting)
    const richBody = document.querySelector('[data-testid="rich-body"]') as HTMLElement;
    richBody.textContent = "*itálico* e **negrito**";
    fireEvent.input(richBody);
    fireEvent.blur(richBody);
    expect(bookOf("A").chapters[0].content).toBe("*itálico* e **negrito**");
    fireEvent.click(screen.getByRole("button", { name: "Prévia" }));
    expect(screen.getByRole("button", { name: "Prévia" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".md-view")).not.toBeNull();
    expect(document.querySelector(".md-view")?.textContent).toContain("itálico");
    fireEvent.click(screen.getByRole("button", { name: "Escrever" }));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(bookOf("A").chapters[0].content).toBe("*itálico* e **negrito**");
    vi.useRealTimers();
  });

  it("shows the empty preview copy when the committed content is empty", () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início", content: "" }] });
    render(manuscriptRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Prévia" }));
    expect(screen.getByText("Sem conteúdo ainda.")).toBeInTheDocument();
    expect(document.querySelector(".md-view")).toBeNull();
  });

  it("does not leak a dirty chapter draft into another chapter (remount isolation)", () => {
    vi.useFakeTimers();
    const projectId = seedProject();
    seedBook(projectId, {
      title: "A",
      chapters: [{ heading: "Um", content: "" }, { heading: "Dois", content: "" }],
    });
    render(manuscriptRoute(projectId));
    const richBody1 = document.querySelector('[data-testid="rich-body"]') as HTMLElement;
    richBody1.textContent = "rascunho";
    fireEvent.input(richBody1);
    fireEvent.click(screen.getByRole("button", { name: /^Dois/ }));
    expect((document.querySelector('[data-testid="rich-body"]') as HTMLElement).textContent).toBe("");
    const chapterByHeading = (heading: string) => bookOf("A").chapters.find((c) => c.heading === heading);
    expect(chapterByHeading("Um")?.content).toBe("rascunho");
    expect(chapterByHeading("Dois")?.content).toBe("");
    expect(screen.getByLabelText("Título do capítulo")).toHaveValue("Dois");
    expect(screen.getByRole("button", { name: /Dois/ })).toHaveClass("active");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(chapterByHeading("Dois")?.content).toBe("");
    const list = screen.getByRole("list", { name: "Capítulos" });
    expect(within(list).getAllByRole("button", { name: /palavra/ })
      .some((row) => row.textContent?.includes("1 palavra"))).toBe(true);
    vi.useRealTimers();
  });

  it("deletes a chapter with a two-step confirm and selects the next remaining", () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um" }, { heading: "Dois" }] });
    render(manuscriptRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Excluir capítulo" }));
    expect(screen.getByRole("button", { name: "Confirmar?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar?" }));
    const chapters = bookOf("A").chapters;
    expect(chapters).toHaveLength(1);
    expect(chapters[0].heading).toBe("Dois");
    expect(screen.getByLabelText("Título do capítulo")).toHaveValue("Dois");
    fireEvent.click(screen.getByRole("button", { name: "Excluir capítulo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar?" }));
    expect(bookOf("A").chapters).toHaveLength(0);
    expect(screen.getByText("Adicione o primeiro capítulo.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Conteúdo")).toBeNull();
  });
});

describe("ExportTools slot", () => {
  it("disables the export buttons until the book has chapters", () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A" });
    render(manuscriptRoute(projectId));
    const epub = screen.getByRole("button", { name: "Exportar EPUB" });
    const pdf = screen.getByRole("button", { name: "Exportar PDF" });
    expect(epub).toBeDisabled();
    expect(pdf).toBeDisabled();
    expect(epub).toHaveAttribute("title", "Adicione capítulos primeiro");
    expect(pdf).toHaveAttribute("title", "Adicione capítulos primeiro");
    fireEvent.click(screen.getByRole("button", { name: "Novo capítulo" }));
    expect(epub).toBeEnabled();
    expect(pdf).toBeEnabled();
    expect(epub).not.toHaveAttribute("title");
  });
});
