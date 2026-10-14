import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";
import type { Manuscript } from "../../domain/types";
import { buildBookHtml } from "./buildBook";

// Real package shape: { EPub (class), default (fn), chapterDefaults, optionsDefaults }.
// The app path instantiates EPub and awaits genEpub() (render() runs inside genEpub).
const epubMock = vi.hoisted(() => ({
  genEpub: vi.fn(async () => new Uint8Array([1, 2, 3])),
  calls: [] as { options: unknown; content: unknown }[],
  expectedOrder: null as string[] | null,
}));

vi.mock("epub-gen-memory", () => ({
  EPub: class {
    constructor(public options: unknown, public content: unknown) {
      epubMock.calls.push({ options, content });
      if (epubMock.expectedOrder) {
        const chapters = Array.isArray(content) ? (content as { title?: unknown }[]) : [];
        expect(chapters.map((chapter) => chapter?.title)).toEqual(epubMock.expectedOrder);
      }
    }
    genEpub(): Promise<Uint8Array> {
      return epubMock.genEpub();
    }
  },
}));

function lastOptions(index: number): Record<string, unknown> {
  return epubMock.calls[index].options as Record<string, unknown>;
}

function seedProject(): string {
  return useScriptorium.getState().addProject("Vellmora").id;
}

function seedBook(projectId: string, spec: {
  title: string;
  author?: string;
  chapters?: { heading: string; content?: string }[];
} = { title: "Livro sem título" }): Manuscript {
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

function manuscriptRoute(projectId: string) {
  return (
    <MemoryRouter initialEntries={[`/p/${projectId}/manuscript`]}>
      <AppRouter />
    </MemoryRouter>
  );
}

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

const ORIGINAL_PRINT = window.print;
let restorePrint = () => {};

function stubWindowPrint(spy: ReturnType<typeof vi.fn>) {
  Object.defineProperty(window, "print", { value: spy, configurable: true });
  restorePrint = () => {
    Object.defineProperty(window, "print", { value: ORIGINAL_PRINT, configurable: true });
    restorePrint = () => {};
  };
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
  epubMock.genEpub.mockClear();
  epubMock.calls.length = 0;
  epubMock.expectedOrder = null;
  stubAnchorDownload();
});

afterEach(() => {
  restoreAnchor();
  restoreAnchor = () => {};
  restorePrint();
  anchorHref = "";
  anchorDownload = "";
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("buildBookHtml", () => {
  it("renders h1 title + optional author + chapters in order with rendered markdown", () => {
    const book: Manuscript = {
      id: "b1",
      projectId: "p1",
      title: "Cantar de Vellmora",
      author: "Renan",
      chapters: [
        { id: "c2", heading: "Fim", content: "A última linha.", order: 1 },
        { id: "c1", heading: "Prólogo", content: "**Negrito** aqui.", order: 0 },
      ],
    };
    const html = buildBookHtml(book);
    expect(html.startsWith('<article class="book">')).toBe(true);
    expect(html).toContain('<h1 class="book-title">Cantar de Vellmora</h1>');
    expect(html).toContain('<p class="book-author">Renan</p>');
    expect(html.indexOf("Prólogo")).toBeLessThan(html.indexOf("Fim"));
    expect(html).toContain('<h2>Prólogo</h2>');
    expect(html).toContain("<strong>Negrito</strong>");
  });

  it("omits the author paragraph when the author is empty", () => {
    const book: Manuscript = {
      id: "b1",
      projectId: "p1",
      title: "T",
      author: "",
      chapters: [],
    };
    expect(buildBookHtml(book)).not.toContain("book-author");
  });

  it("renders the empty-content paragraph for chapters without body", () => {
    const book: Manuscript = {
      id: "b1",
      projectId: "p1",
      title: "T",
      author: "A",
      chapters: [{ id: "c1", heading: "Vazio", content: "", order: 0 }],
    };
    expect(buildBookHtml(book)).toContain('<p class="empty">Sem conteúdo ainda.</p>');
  });

  it("escapes book title, author and heading text", () => {
    const book: Manuscript = {
      id: "b1",
      projectId: "p1",
      title: "Livro <b>X</b>",
      author: "An & Co",
      chapters: [{ id: "c1", heading: "Cap > 1", content: "corpo", order: 0 }],
    };
    const html = buildBookHtml(book);
    expect(html).toContain("Livro &lt;b&gt;X&lt;/b&gt;");
    expect(html).toContain("An &amp; Co");
    expect(html).toContain("Cap &gt; 1");
  });
});

describe("EPUB export", () => {
  it("assembles the book in order, downloads <slug>.epub and shows the success toast", async () => {
    const projectId = seedProject();
    seedBook(projectId, {
      title: "Cantar de Vellmora",
      author: "Renan",
      chapters: [
        { heading: "Prólogo", content: "**Negrito** aqui." },
        { heading: "Fim", content: "A última linha." },
      ],
    });
    epubMock.expectedOrder = ["Prólogo", "Fim"];
    render(manuscriptRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => t.message === "EPUB gerado.")).toBe(true);
    });
    expect(epubMock.calls).toHaveLength(1);
    expect(epubMock.genEpub).toHaveBeenCalledTimes(1);
    const content = epubMock.calls[0].content as { title: string; content: string }[];
    expect(content).toHaveLength(2);
    expect(content[0]).toMatchObject({ title: "Prólogo" });
    expect(content[0].content).toContain("<strong>Negrito</strong>");
    expect(content[1]).toMatchObject({ title: "Fim" });
    expect(lastOptions(0)).toEqual(expect.objectContaining({ title: "Cantar de Vellmora", author: "Renan", lang: "pt" }));
    expect(anchorDownload).toBe("cantar-de-vellmora.epub");
    expect(anchorHref).toBe("blob:mock-url");
    expect(screen.getByRole("button", { name: "Exportar EPUB" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Exportar EPUB" })).not.toHaveAttribute("aria-busy");
  });

  it("passes the project cover only when one exists", async () => {
    const projectId = seedProject();
    const key = useScriptorium.getState().putImage("data:image/png;base64,COVER", "cover");
    useScriptorium.getState().updateProject(projectId, { coverImageKey: key });
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "x" }] });
    const covered = render(manuscriptRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    expect(lastOptions(0)).toEqual(expect.objectContaining({ cover: "data:image/png;base64,COVER" }));
    covered.unmount();

    useScriptorium.setState(useScriptorium.getInitialState());
    const bareId = seedProject();
    seedBook(bareId, { title: "B", chapters: [{ heading: "Um", content: "x" }] });
    render(manuscriptRoute(bareId));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(2));
    expect("cover" in lastOptions(1)).toBe(false);
  });

  it("falls back to the 'livro' slug when the title has no alnum characters", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "???", chapters: [{ heading: "Um", content: "x" }] });
    render(manuscriptRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Exportar EPUB" }));
    await waitFor(() => expect(epubMock.calls).toHaveLength(1));
    expect(anchorDownload).toBe("livro.epub");
  });

  it("shows disabled + aria-busy while generating, then re-enables", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "x" }] });
    let resolve!: (value: never) => void;
    epubMock.genEpub.mockImplementationOnce(
      () => new Promise<never>((res) => { resolve = res; }),
    );
    render(manuscriptRoute(projectId));
    const button = screen.getByRole("button", { name: "Exportar EPUB" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");
    resolve([1, 2, 3] as never);
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).not.toHaveAttribute("aria-busy");
    expect(epubMock.genEpub).toHaveBeenCalledTimes(1);
  });

  it("toasts the failure message and re-enables the button", async () => {
    const projectId = seedProject();
    seedBook(projectId, { title: "A", chapters: [{ heading: "Um", content: "x" }] });
    epubMock.genEpub.mockRejectedValueOnce(new Error("boom"));
    render(manuscriptRoute(projectId));
    const button = screen.getByRole("button", { name: "Exportar EPUB" });
    fireEvent.click(button);
    await waitFor(() => {
      expect(useScriptorium.getState().toasts.some((t) => t.message === "Falha ao gerar o EPUB.")).toBe(true);
    });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });
});

describe("PDF export", () => {
  it("renders the print book with h1 + first chapter h2 and calls window.print", async () => {
    const projectId = seedProject();
    seedBook(projectId, {
      title: "Cantar de Vellmora",
      chapters: [
        { heading: "Prólogo", content: "Uma noite." },
        { heading: "Fim", content: "Duas." },
      ],
    });
    const printSpy = vi.fn();
    stubWindowPrint(printSpy);
    render(manuscriptRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    const printBook = screen.getByTestId("print-book");
    expect(printBook.querySelector("h1")?.textContent).toBe("Cantar de Vellmora");
    expect(printBook.querySelector("h2")?.textContent).toBe("Prólogo");
    await waitFor(() => expect(printSpy).toHaveBeenCalled());
  });

  it("unmounts the print book after the fallback timeout", async () => {
    vi.useFakeTimers();
    const projectId = seedProject();
    seedBook(projectId, {
      title: "Cantar",
      chapters: [{ heading: "Prólogo", content: "Uma noite." }],
    });
    const printSpy = vi.fn();
    stubWindowPrint(printSpy);
    render(manuscriptRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    expect(screen.getByTestId("print-book")).toBeInTheDocument();
    act(() => vi.runAllTimers());
    expect(screen.queryByTestId("print-book")).toBeNull();
  });
});
