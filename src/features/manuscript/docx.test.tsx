import { beforeEach, describe, expect, it, vi } from "vitest";
import { htmlToBlocks } from "./docx";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useScriptorium } from "../../data/store";
import { DocxReplaceButton } from "./ChapterList";

vi.mock("mammoth", async () => {
  const convertToHtml = async () => ({ value: "<p>Importado do Word.</p>" });
  return { default: { convertToHtml }, convertToHtml };
});

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("htmlToBlocks", () => {
  it("splits into p/h/li/quote blocks", () => {
    const blocks = htmlToBlocks("<p>um</p><h2>título</h2><ul><li>a</li><li>b</li></ul><blockquote>fala</blockquote>");
    expect(blocks).toEqual([
      { kind: "p", text: "um" },
      { kind: "h2", text: "título" },
      { kind: "li", text: "a" },
      { kind: "li", text: "b" },
      { kind: "quote", text: "fala" },
    ]);
  });
  it("discards script bodies", () => {
    const blocks = htmlToBlocks("<p>ok</p><script>evil()</script>");
    expect(blocks).toEqual([{ kind: "p", text: "ok" }]);
  });
});

describe("DocxReplaceButton", () => {
  it("imports html via mammoth and replaces content", async () => {
    useScriptorium.setState(useScriptorium.getInitialState());
    localStorage.clear();
    act(() => { store().addProject("V"); });
    act(() => { store().addManuscript(store().projects[0].id, "Livro"); });
    act(() => { store().addChapter(store().manuscripts[0].id, "Cap"); });
    render(<DocxReplaceButton chapterId={store().manuscripts[0].chapters[0].id} />);
    const input = screen.getByLabelText("Replace with .docx") as HTMLInputElement;
    const file = new File(["docx-bytes"], "ch.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => expect(store().manuscripts[0].chapters[0].content).toBe("<p>Importado do Word.</p>"), { timeout: 3000 });
  });
});
