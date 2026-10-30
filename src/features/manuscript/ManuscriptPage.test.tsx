import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { pickSelectOptionSync, selectOption } from "../../test/selectHelper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { useWriteme } from "../../data/store";
import { ChapterEditor } from "./ChapterEditor";
import type { Manuscript } from "../../domain/types";

type BookSpec = {
  title?: string;
  author?: string;
  chapters?: { heading?: string; content?: string }[];
};

function seedProject(): string {
  return useWriteme.getState().addProject("Vellmora").id;
}

function seedBook(projectId: string, spec: BookSpec = {}): Manuscript {
  const created = useWriteme.getState().addManuscript(projectId, spec.title);
  if (spec.author) useWriteme.getState().setManuscriptAuthor(created.id, spec.author);
  for (const ch of spec.chapters ?? []) {
    const chapter = useWriteme.getState().addChapter(created.id, ch.heading);
    if (chapter && ch.content !== undefined) {
      useWriteme.getState().replaceChapterBody(chapter.id, ch.content);
    }
  }
  const book = useWriteme.getState().manuscripts.find((m) => m.id === created.id);
  expect(book, "seeded book should exist").toBeTruthy();
  return book as Manuscript;
}

function projectBooks(projectId: string): Manuscript[] {
  return useWriteme.getState().manuscripts.filter((m) => m.projectId === projectId);
}

function bookOf(title: string): Manuscript {
  const book = useWriteme.getState().manuscripts.find((m) => m.title === title);
  expect(book, `book ${title} should exist`).toBeTruthy();
  return book as Manuscript;
}

async function manuscriptRoute(projectId: string): Promise<void> {
  render(
    <MemoryRouter initialEntries={[`/p/${projectId}/manuscript`]}>
      <AppRouter />
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.queryByTestId("hydration-splash")).toBeNull();
    expect(screen.queryByTestId("chunk-splash")).toBeNull();
  }, { timeout: 10000 });
}

function chapterList() {
  return screen.getByRole("list", { name: "Chapters" });
}

/** Chapter select row (the .book-ch-row button): several buttons mention a
 *  heading (drag handle, "New scene in …"), so the query is specific. */
function chapterRow(heading: string): HTMLElement {
  const rows = within(chapterList()).getAllByRole("button")
    .filter((b) => Array.from(b.classList).includes("book-ch-row")
      && (b as HTMLElement).textContent?.includes(heading));
  expect(rows).toHaveLength(1);
  return rows[0] as HTMLElement;
}

/** dnd-kit needs real rects: the row li's get stacked geometry for the
 *  duration of a drag. */
function mockRowRects(): () => void {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
    const list = chapterListLive();
    if (!list) return original.call(this);
    const rows = Array.from(list.querySelectorAll("li")) as Element[];
    // exact identity first; nested li's own their own row (contains() would
    // map a scene li onto its chapter li)
    const exact = rows.includes(this) ? this : (this.closest("li"));
    const idx = exact ? rows.indexOf(exact) : -1;
    if (idx < 0) return original.call(this);
    return new DOMRect(0, idx * 40, 300, 40);
  };
  return () => { Element.prototype.getBoundingClientRect = original; };
}

function chapterListLive(): HTMLElement | null {
  return document.querySelector(".book-ch-rows");
}

const flushDrag = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
};

/** Keyboard-driven dnd-kit drag: grab on the handle, then one step per key. */
async function dragWithKeyboard(handle: HTMLElement, keys: string[]) {
  handle.focus();
  fireEvent.keyDown(handle, { key: " ", code: "Space" });
  await flushDrag();
  for (const key of keys) {
    fireEvent.keyDown(document.activeElement ?? handle, { key, code: key });
    await flushDrag();
  }
  fireEvent.keyDown(document.activeElement ?? handle, { key: " ", code: "Space" });
  await flushDrag();
}

function rowHeadings() {
  return within(chapterList())
    .getAllByRole("button", { name: /word/ })
    .map((row) => row.querySelector(".book-ch-heading")?.textContent);
}

beforeEach(() => {
  localStorage.clear();
  useWriteme.setState(useWriteme.getInitialState());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ManuscriptPage books", () => {
  it("renders the book page on the manuscript route, replacing the placeholder", async () => {
    const projectId = seedProject();
    seedBook(projectId, { chapters: [{ heading: "Prólogo", content: "Uma noite." }] });
    await manuscriptRoute(projectId);
    expect(screen.getByRole("button", { name: "New book" })).toBeInTheDocument();
    expect(screen.queryByText(/sub-projeto 4/i)).not.toBeInTheDocument();
  });

  it("shows the empty-state copy and creates the first book", async () => {
    const projectId = seedProject();
    await manuscriptRoute(projectId);
    expect(screen.getByText("Start your book — create the first one.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New book" }));
    const books = projectBooks(projectId);
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe("Untitled Manuscript");
    expect(books[0].author).toBe("");
    expect(screen.getByLabelText("Manuscript title")).toHaveValue("Untitled Manuscript");
  });

  it("auto-selects the single book, shows its title as a heading and opens its first chapter", async () => {
    const projectId = seedProject();
    seedBook(projectId, {
      title: "Cantar de Vellmora",
      chapters: [{ heading: "Prólogo", content: "Uma noite." }],
    });
    await manuscriptRoute(projectId);
    expect(screen.queryByLabelText("Livro")).toBeNull();
    expect(screen.getByRole("heading", { name: "Cantar de Vellmora" })).toBeInTheDocument();
    expect(screen.getByLabelText("Manuscript title")).toHaveValue("Cantar de Vellmora");
    expect(screen.getByLabelText("Author")).toHaveValue("");
    expect(screen.getByLabelText("Chapter title")).toHaveValue("Prólogo");
    expect(chapterRow("Prólogo")).toHaveClass("active");
  });

  it("selects among books when there are several and switches the editor", async () => {
    const projectId = seedProject();
    seedBook(projectId, {
      title: "Cantar de Vellmora",
      chapters: [{ heading: "Prólogo", content: "Uma noite." }],
    });
    seedBook(projectId, {
      title: "Segundo Livro",
      chapters: [{ heading: "Capítulo A", content: "Aqui." }],
    });
    await manuscriptRoute(projectId);
    const select = screen.getByLabelText("Book");
    expect(select).toHaveTextContent("Cantar de Vellmora"); // most recent book
    await pickSelectOptionSync(() => screen.getByLabelText("Book"), "Segundo Livro");
    expect(screen.queryByRole("heading", { name: "Cantar de Vellmora" })).toBeNull();
    expect(screen.getByLabelText("Manuscript title")).toHaveValue("Segundo Livro");
    expect(screen.getByLabelText("Chapter title")).toHaveValue("Capítulo A");
  });

  it("commits book title and author edits debounced and on blur, updating the heading", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "Cantar", author: "Renan" });
    await manuscriptRoute(projectId);
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Manuscript title"), { target: { value: "Cantar Completo" } });
    fireEvent.change(screen.getByLabelText("Author"), { target: { value: "Outro" } });
    expect(projectBooks(projectId)[0].title).toBe("Cantar");
    expect(projectBooks(projectId)[0].author).toBe("Renan");
    expect(screen.getByRole("heading", { name: "Cantar" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(projectBooks(projectId)[0].title).toBe("Cantar Completo");
    expect(projectBooks(projectId)[0].author).toBe("Outro");
    expect(screen.getByRole("heading", { name: "Cantar Completo" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Author"), { target: { value: "Nova" } });
    fireEvent.blur(screen.getByLabelText("Author"));
    expect(projectBooks(projectId)[0].author).toBe("Nova");
  });

  it("does not leak a dirty book title draft when switching books", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A" });
    seedBook(projectId, { title: "B" });
    await manuscriptRoute(projectId);
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Manuscript title"), { target: { value: "A editado" } });
    pickSelectOptionSync(() => screen.getByLabelText("Book"), "B");
    expect(screen.getByLabelText("Manuscript title")).toHaveValue("B");
    expect(projectBooks(projectId).find((m) => m.title === "A editado")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(bookOf("B").title).toBe("B");
    vi.useRealTimers();
  });

  it("deletes the selected book with a two-step confirm and selects the first remaining, then none", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um" }] });
    seedBook(projectId, { title: "B", chapters: [{ heading: "Dois" }] });
    await manuscriptRoute(projectId);
    pickSelectOptionSync(() => screen.getByLabelText("Book"), "B");
    fireEvent.click(screen.getByRole("button", { name: "Delete book" }));
    expect(screen.getByRole("button", { name: "Confirm?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    expect(projectBooks(projectId).map((m) => m.title)).toEqual(["A"]);
    expect(screen.getByLabelText("Manuscript title")).toHaveValue("A");
    fireEvent.click(screen.getByRole("button", { name: "Delete book" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    expect(projectBooks(projectId)).toHaveLength(0);
    expect(screen.getByText("Start your book — create the first one.")).toBeInTheDocument();
  });

  it("resets the book delete confirmation after 3s", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A" });
    await manuscriptRoute(projectId);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Delete book" }));
    expect(screen.getByRole("button", { name: "Confirm?" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("button", { name: "Delete book" })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("ManuscriptPage chapters", () => {
  it("creates a chapter, selects it and focuses the heading", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A" });
    await manuscriptRoute(projectId);
    expect(screen.getByText("Add the first chapter.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New chapter" }));
    const chapters = bookOf("A").chapters;
    expect(chapters).toHaveLength(1);
    expect(chapters[0].heading).toBe("Untitled Chapter");
    expect(chapters[0].order).toBe(0);
    expect(chapters[0].scenes).toHaveLength(1);
    expect(screen.getByLabelText("Chapter title")).toHaveFocus();
    expect(chapterRow("Untitled Chapter")).toHaveClass("active");
    expect(screen.queryByText("Add the first chapter.")).toBeNull();
  });

  it("lists chapters in order; reordering is drag-only (no arrow buttons)", async () => {
    const projectId = seedProject();
    seedBook(projectId, {
      title: "A",
      chapters: [
        { heading: "Início", content: "um" },
        { heading: "Meio", content: "um dois" },
        { heading: "Fim", content: "um dois três" },
      ],
    });
    await manuscriptRoute(projectId);
    expect(rowHeadings()).toEqual(["Início", "Meio", "Fim"]);
    expect(screen.queryByRole("button", { name: "Move chapter up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move chapter down" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move part up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move part down" })).toBeNull();
  });

  it("reorders chapters with a keyboard drag", async () => {
    const projectId = seedProject();
    seedBook(projectId, {
      title: "A",
      chapters: [
        { heading: "Início", content: "um" },
        { heading: "Meio", content: "um dois" },
        { heading: "Fim", content: "um dois três" },
      ],
    });
    const restoreRects = mockRowRects();
    try {
      await manuscriptRoute(projectId);
      const handle = within(chapterList()).getAllByRole("button", { name: "Drag chapter" })[0];
      await dragWithKeyboard(handle, ["ArrowDown"]); // one row down
      expect(rowHeadings()).toEqual(["Meio", "Início", "Fim"]);
      const orders = Object.fromEntries(
        bookOf("A").chapters.map((c) => [c.heading, c.order]),
      );
      expect(orders).toEqual({ Início: 1, Meio: 0, Fim: 2 });
      expect(chapterRow("Início")).toHaveClass("active");
    } finally {
      restoreRects();
    }
  });

  it("shows store wordcounts in rows and keeps the editor footer live from the draft", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início", content: "um dois três" }] });
    await manuscriptRoute(projectId);
    vi.useFakeTimers();
    expect(chapterRow("Início").textContent).toContain("3 words");
    // rich body: 6 words typed directly in the contenteditable (footer counts DOM)
    const richBody = () => document.querySelector('[data-testid="rich-scene-1"]') as HTMLElement;
    richBody().textContent = "um dois três quatro mais uma";
    fireEvent.input(richBody());
    expect(screen.getByText("6 words")).toBeInTheDocument();
    expect(chapterRow("Início").textContent).toContain("3 words");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(chapterRow("Início").textContent).toContain("6 words");
    vi.useRealTimers();
  });

  it("commits chapter heading and body edits debounced and on blur", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início" }] });
    await manuscriptRoute(projectId);
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Chapter title"), { target: { value: "Chegada" } });
    const richBody = document.querySelector('[data-testid="rich-scene-1"]') as HTMLElement;
    richBody.textContent = "Torres de pedra.";
    fireEvent.input(richBody);
    expect(bookOf("A").chapters[0]).toMatchObject({ heading: "Início", scenes: [{ content: "" }] });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(bookOf("A").chapters[0]).toMatchObject({ heading: "Chegada", scenes: [{ content: "Torres de pedra." }] });
    fireEvent.change(screen.getByLabelText("Chapter title"), { target: { value: "Partida" } });
    fireEvent.blur(screen.getByLabelText("Chapter title"));
    expect(bookOf("A").chapters[0].heading).toBe("Partida");
    vi.useRealTimers();
  });

  it("adds a scene from the editor divider and types in each scene", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início", content: "primeira cena." }] });
    await manuscriptRoute(projectId);
    fireEvent.click(screen.getByRole("button", { name: "New scene" }));
    const chapter = bookOf("A").chapters[0];
    expect(chapter.scenes).toHaveLength(2);
    const second = document.querySelector('[data-testid="rich-scene-2"]') as HTMLElement;
    expect(second).toBeInTheDocument();
    second.textContent = "segunda cena.";
    fireEvent.input(second);
    fireEvent.blur(second);
    const scenes = bookOf("A").chapters[0].scenes;
    expect(scenes.map((s) => s.content)).toEqual(["primeira cena.", "segunda cena."]);
    expect(scenes.map((s) => s.order)).toEqual([0, 1]);
  });

  it("deletes a scene immediately but keeps the last one", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início", content: "só esta." }] });
    await manuscriptRoute(projectId);
    // the single scene's delete control is disabled
    const del = screen.getAllByRole("button", { name: "Delete scene" })[0];
    expect(del).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "New scene" }));
    const dels = screen.getAllByRole("button", { name: "Delete scene" });
    expect(dels[0]).toBeEnabled();
    fireEvent.click(dels[1]); // delete the empty second scene
    const scenes = bookOf("A").chapters[0].scenes;
    expect(scenes).toHaveLength(1);
    expect(scenes[0].content).toContain("só esta");
  });

  it("flushes the draft when toggling to Preview and renders the committed markdown", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início" }] });
    await manuscriptRoute(projectId);
    vi.useFakeTimers();
    expect(screen.getByRole("button", { name: "Write" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "false");
    // rich editor: blur commits whatever the body holds (markdown text survives
    // as text until the user applies rich formatting)
    const richBody = document.querySelector('[data-testid="rich-scene-1"]') as HTMLElement;
    richBody.textContent = "*itálico* e **negrito**";
    fireEvent.input(richBody);
    fireEvent.blur(richBody);
    expect(bookOf("A").chapters[0].scenes[0].content).toBe("*itálico* e **negrito**");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".md-view")).not.toBeNull();
    expect(document.querySelector(".md-view")?.textContent).toContain("itálico");
    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(bookOf("A").chapters[0].scenes[0].content).toBe("*itálico* e **negrito**");
    vi.useRealTimers();
  });

  it("the none ornament previews scenes as one flow; the default keeps the marker", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Início", content: "primeira." }] });
    act(() => { useWriteme.getState().addScene(book.chapters[0].id); });
    const scenes = bookOf("A").chapters[0].scenes;
    act(() => { useWriteme.getState().updateScene(scenes[1].id, { content: "segunda." }); });
    await manuscriptRoute(projectId);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(document.querySelectorAll(".md-view .scene-marker")).toHaveLength(1);
    expect(document.querySelector(".md-view")?.textContent).toContain("primeira.");
    // the author's choice: scene break reads as one text, no marker
    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    act(() => { useWriteme.getState().setBindery(bookOf("A").id, { sceneOrnament: "none" }); });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(document.querySelectorAll(".md-view .scene-marker")).toHaveLength(0);
    expect(document.querySelector(".md-view")?.textContent).toContain("segunda.");
  });

  it("shows the empty preview copy when the committed content is empty", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Início" }] });
    await manuscriptRoute(projectId);
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("No content yet.")).toBeInTheDocument();
    expect(document.querySelector(".md-view")).toBeNull();
  });

  it("does not leak a dirty chapter draft into another chapter (remount isolation)", async () => {
    const projectId = seedProject();
    seedBook(projectId, {
      title: "A",
      chapters: [{ heading: "Um" }, { heading: "Dois" }],
    });
    await manuscriptRoute(projectId);
    vi.useFakeTimers();
    const richBody1 = document.querySelector('[data-testid="rich-scene-1"]') as HTMLElement;
    richBody1.textContent = "rascunho";
    fireEvent.input(richBody1);
    fireEvent.click(chapterRow("Dois"));
    expect((document.querySelector('[data-testid="rich-scene-1"]') as HTMLElement).textContent).toBe("");
    const chapterByHeading = (heading: string) => bookOf("A").chapters.find((c) => c.heading === heading);
    expect(chapterByHeading("Um")?.scenes[0].content).toBe("rascunho");
    expect(chapterByHeading("Dois")?.scenes[0].content).toBe("");
    expect(screen.getByLabelText("Chapter title")).toHaveValue("Dois");
    expect(chapterRow("Dois")).toHaveClass("active");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(chapterByHeading("Dois")?.scenes[0].content).toBe("");
    const list = chapterList();
    expect(within(list).getAllByRole("button", { name: /word/ })
      .some((row) => row.textContent?.includes("1 word"))).toBe(true);
    vi.useRealTimers();
  });

  it("deletes a chapter with a two-step confirm and selects the next remaining", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um" }, { heading: "Dois" }] });
    await manuscriptRoute(projectId);
    fireEvent.click(screen.getByRole("button", { name: "Delete chapter" }));
    expect(screen.getByRole("button", { name: "Confirm?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    const chapters = bookOf("A").chapters;
    expect(chapters).toHaveLength(1);
    expect(chapters[0].heading).toBe("Dois");
    expect(screen.getByLabelText("Chapter title")).toHaveValue("Dois");
    fireEvent.click(screen.getByRole("button", { name: "Delete chapter" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    expect(bookOf("A").chapters).toHaveLength(0);
    expect(screen.getByText("Add the first chapter.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Content")).toBeNull();
  });
});

describe("ManuscriptPage parts", () => {
  /** DOM order of the list rows: part headers and chapter rows interleaved. */
  function partRowOrder(): string[] {
    const list = chapterList();
    return Array.from(list.querySelectorAll("li")).flatMap((li) => {
      if (li.classList.contains("book-part-row")) {
        return [`part:${li.querySelector(".book-part-title")?.textContent ?? ""}`];
      }
      if (li.querySelector(".book-ch-row")) {
        return [`chapter:${li.querySelector(".book-ch-heading")?.textContent ?? ""}`];
      }
      return [];
    });
  }

  it("groups chapters under their part header and shows a block word count", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Base", content: "um" }] });
    act(() => {
      const part = useWriteme.getState().addPart(book.id, "A Queda")!;
      const ch = useWriteme.getState().addChapter(book.id, "Cinzas")!;
      useWriteme.getState().replaceChapterBody(ch.id, "uma duas três");
      useWriteme.getState().setChapterPart(ch.id, part.id);
    });
    await manuscriptRoute(projectId);
    expect(await screen.findByText("A Queda")).toBeInTheDocument();
    expect(screen.getByTestId("part-words-A Queda")).toHaveTextContent("3 words");
    expect(partRowOrder()).toEqual(["chapter:Base", "part:A Queda", "chapter:Cinzas"]);
  });

  it("assigns a chapter to a part from the editor", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um" }] });
    act(() => {
      useWriteme.getState().addPart(book.id, "A Queda");
    });
    await manuscriptRoute(projectId);
    await selectOption(() => screen.getByLabelText("Part"), "A Queda");
    expect(bookOf("A").chapters[0].partId).toBeTruthy();
  });

  it("clears the part assignment through the empty No part option", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um" }] });
    act(() => {
      const part = useWriteme.getState().addPart(book.id, "A Queda")!;
      useWriteme.getState().setChapterPart(book.chapters[0].id, part.id);
    });
    await manuscriptRoute(projectId);
    await selectOption(() => screen.getByLabelText("Part"), "No part");
    expect(bookOf("A").chapters[0].partId).toBeUndefined();
  });

  it("creates and renames parts from the list", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um" }] });
    await manuscriptRoute(projectId);
    const partTitles = () =>
      [...(bookOf("A").parts ?? [])].sort((a, b) => a.order - b.order).map((p) => p.title);
    fireEvent.click(screen.getByRole("button", { name: "New part" }));
    fireEvent.click(screen.getByRole("button", { name: "New part" }));
    expect(partTitles()).toEqual(["Untitled Part", "Untitled Part"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Rename part" })[0]);
    const titleInput = screen.getByLabelText("Part title");
    fireEvent.change(titleInput, { target: { value: "A Queda" } });
    fireEvent.blur(titleInput);
    expect(partTitles()).toEqual(["A Queda", "Untitled Part"]);
  });

  it("reorders a part with a keyboard drag", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um" }] });
    const restoreRects = mockRowRects();
    try {
      await manuscriptRoute(projectId);
      fireEvent.click(screen.getByRole("button", { name: "New part" }));
      fireEvent.click(screen.getByRole("button", { name: "New part" }));
      const [first, second] = bookOf("A").parts!;
      const handle = screen.getAllByRole("button", { name: "Drag part" })[1];
      await dragWithKeyboard(handle, ["ArrowUp"]); // one row up
      // the dragged part (second) now opens the parts in print order
      const ordered = [...bookOf("A").parts!].sort((a, b) => a.order - b.order).map((p) => p.id);
      expect(ordered).toEqual([second.id, first.id]);
      expect(bookOf("A").parts!.map((p) => p.order).sort()).toEqual([1, 2]);
    } finally {
      restoreRects();
    }
  });

  it("sums the chapters' words for the part total", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "uma duas três" }] });
    act(() => {
      const part = useWriteme.getState().addPart(book.id, "A Queda")!;
      const ch = useWriteme.getState().addChapter(book.id, "Dois")!;
      useWriteme.getState().replaceChapterBody(ch.id, "quatro cinco");
      useWriteme.getState().setChapterPart(ch.id, part.id);
      useWriteme.getState().setChapterPart(book.chapters[0].id, part.id);
    });
    await manuscriptRoute(projectId);
    expect(screen.getByTestId("part-words-A Queda")).toHaveTextContent("5 words");
    expect(partRowOrder()).toEqual(["part:A Queda", "chapter:Um", "chapter:Dois"]);
  });

  it("deletes a part with a two-step confirm and releases its chapters", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um" }, { heading: "Dois" }] });
    act(() => {
      const part = useWriteme.getState().addPart(book.id, "A Queda")!;
      useWriteme.getState().setChapterPart(book.chapters[1].id, part.id);
    });
    await manuscriptRoute(projectId);
    fireEvent.click(screen.getByRole("button", { name: "Delete part" }));
    expect(screen.getByRole("button", { name: "Confirm?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm?" }));
    expect(bookOf("A").parts ?? []).toHaveLength(0);
    expect(bookOf("A").chapters).toHaveLength(2);
    expect(bookOf("A").chapters[1].partId).toBeUndefined();
    expect(partRowOrder()).toEqual(["chapter:Um", "chapter:Dois"]);
  });

  it("resets the part delete confirmation after 3s", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A" });
    act(() => {
      useWriteme.getState().addPart(book.id, "A Queda");
    });
    await manuscriptRoute(projectId);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Delete part" }));
    expect(screen.getByRole("button", { name: "Confirm?" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("button", { name: "Delete part" })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("ManuscriptPage scenes sidebar", () => {
  it("chapters start collapsed; the chevron reveals the scene rows", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "cena um." }] });
    act(() => { useWriteme.getState().addScene(book.chapters[0].id); });
    await manuscriptRoute(projectId);
    expect(within(chapterList()).queryAllByRole("button", { name: /Scene 2/ })).toHaveLength(0);
    const chevron = within(chapterList()).getAllByRole("button", { name: /Scenes of Um/ })[0];
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(chevron);
    expect(chevron).toHaveAttribute("aria-expanded", "true");
    expect(within(chapterList()).getAllByRole("button", { name: "Scene 2" })).toHaveLength(1);
  });

  it("a named scene keeps its name in the sidebar across reorders", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "cena um." }, { heading: "Dois" }] });
    act(() => {
      const st = useWriteme.getState();
      st.updateScene(book.chapters[0].scenes[0].id, { title: "Na ponte" });
      st.addScene(book.chapters[0].id);
    });
    const restoreRects = mockRowRects();
    try {
      await manuscriptRoute(projectId);
      // chapter 1 starts collapsed: expand both, then drag the named scene down
      for (const chevron of within(chapterList()).getAllByRole("button", { name: /Scenes of/ })) {
        fireEvent.click(chevron);
      }
      const handle = within(chapterList()).getAllByRole("button", { name: "Drag scene 1" })[0];
      // two steps cross into the next chapter (append at its end)
      await dragWithKeyboard(handle, ["ArrowDown", "ArrowDown"]);
      const chapters = bookOf("A").chapters;
      expect(chapters[1].scenes.map((s) => s.title)).toContain("Na ponte");
      expect(chapters[1].scenes.map((s) => s.content)).toContain("cena um.");
    } finally {
      restoreRects();
    }
  });

  it("nests the chapter's scenes under the chapter row and selects the scene in the editor", async () => {
    const projectId = seedProject();
    const book = seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "cena um." }] });
    act(() => { useWriteme.getState().addScene(book.chapters[0].id); });
    await manuscriptRoute(projectId);
    // chapters start collapsed: expand, then the rows appear
    fireEvent.click(within(chapterList()).getAllByRole("button", { name: /Scenes of Um/ })[0]);
    const scene2 = within(chapterList()).getAllByRole("button", { name: "Scene 2" })[0];
    fireEvent.click(scene2);
    // the editor reveals the scene: scene 2's contenteditable exists and gains focus
    await waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('[data-testid="rich-scene-2"]'));
    });
  });
});

describe("ManuscriptPage focus mode", () => {
  it("hides the book chrome and the sidebar, centering only the writing surface", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "corpo." }] });
    await manuscriptRoute(projectId);
    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    // the header + inputs + sidebar disappear
    expect(screen.queryByRole("button", { name: "New book" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Chapters" })).toBeNull();
    expect(screen.queryByLabelText("Manuscript title")).toBeNull();
    // the writing surface stays: heading + toolbar + scene body
    expect(screen.getByLabelText("Chapter title")).toBeInTheDocument();
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(document.querySelector('[data-testid="rich-scene-1"]')).not.toBeNull();
    expect(document.querySelector("[data-testid='focus-surface']")).not.toBeNull();
    // the part select and the delete chapter control leave focus mode
    expect(screen.queryByLabelText("Part")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete chapter" })).toBeNull();
  });

  it("keeps the word count; the notes panel stays out of focus mode", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "corpo." }] });
    await manuscriptRoute(projectId);
    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    expect(screen.queryByText(/Notes and scene/i)).toBeNull();
    expect(document.querySelector(".book-words")).not.toBeNull();
  });
});

describe("Notes panel default state", () => {
  it("notes open collapsed by default and the end marker field shares the note field background", async () => {
    const m = useWriteme.getState().addManuscript("prj_1", "Livro A");
    const ch = useWriteme.getState().addChapter(m.id, "Um")!;
    render(<ChapterEditor chapterId={ch.id} onDeleted={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Notes and scene/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = trigger.closest("[data-slot='notes-panel']") as HTMLElement;
    expect(within(panel).queryByLabelText("Prologue")).toBeTruthy();
    expect(within(panel).queryByLabelText("End-of-chapter marker")).toBeNull();
    // the end marker row appears once the epilogue exists
    act(() => { store().updateChapter(ch.id, { noteEnd: "Fim." }); });
    const marker = screen.getByLabelText("End-of-chapter marker");
    expect(marker.className).toContain("book-end-marker-input");
  });
});

describe("export belongs to Publishing", () => {
  it("the manuscript page shows no export controls", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "x" }] });
    await manuscriptRoute(projectId);
    expect(screen.queryByRole("button", { name: "Exportar EPUB" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Exportar Word" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Exportar PDF" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  });
});

const store = useWriteme.getState;

describe("ChapterEditor — notes panel", () => {
  it("notes and calendar link live inside ONE collapsible panel, closed by default", async () => {
    const m = useWriteme.getState().addManuscript("prj_1", "Livro A");
    const ch = useWriteme.getState().addChapter(m.id, "Um")!;
    store().updateChapter(ch.id, { noteTop: "Abre a história" });
    render(<ChapterEditor chapterId={ch.id} onDeleted={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Notes and scene/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // all notes blocks are inside the panel
    const panel = trigger.closest("[data-slot='notes-panel']") as HTMLElement;
    expect(panel).toBeTruthy();
    expect(within(panel).queryByLabelText("Prologue")).toBeTruthy();
    expect(within(panel).queryByLabelText("Epilogue")).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(within(panel).queryByLabelText("Prologue")).not.toBeVisible();
  });
});

// panel helper stays in this file; ChapterEditor imported at top
