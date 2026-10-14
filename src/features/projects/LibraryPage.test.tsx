import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useScriptorium } from "../../data/store";
import { LibraryPage } from "./LibraryPage";

function wrap() {
  return (
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  useScriptorium.setState(useScriptorium.getInitialState());
  localStorage.clear();
});

describe("LibraryPage", () => {
  it("empty state invites creating first world", () => {
    render(wrap());
    expect(screen.getByText(/Crie seu primeiro mundo/i)).toBeInTheDocument();
  });
  it("creates project through the form", async () => {
    render(wrap());
    fireEvent.click(screen.getByRole("button", { name: /novo mundo/i }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Shimradis" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() =>
      expect(useScriptorium.getState().projects.map((p) => p.name)).toEqual(["Shimradis"]));
    expect(screen.getByText("Shimradis")).toBeInTheDocument();
  });
  it("deletes with confirmation modal", async () => {
    act(() => { useScriptorium.getState().addProject("Velho"); });
    render(wrap());
    fireEvent.click(screen.getByTitle("Excluir projeto"));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(useScriptorium.getState().projects).toHaveLength(0));
  });
  it("links to workspace", () => {
    const p = useScriptorium.getState().addProject("Linkado");
    render(wrap());
    const link = screen.getByRole("link", { name: /Linkado/i });
    expect(link).toHaveAttribute("href", `/p/${p.id}`);
  });
  it("offers demo seed on first use and creates a populated project", async () => {
    render(wrap());
    expect(screen.getByRole("button", { name: /novo mundo/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /carregar.*exemplo/i }));
    await waitFor(() => expect(useScriptorium.getState().seedFlag).toBe(true));
    expect(useScriptorium.getState().projects).toHaveLength(1);
    expect(useScriptorium.getState().entries.length).toBeGreaterThanOrEqual(6);
    expect(useScriptorium.getState().toasts.some((t) => t.message === "Projeto de exemplo carregado.")).toBe(true);
  });
  it("hides seed button once a project exists", () => {
    useScriptorium.getState().addProject("X");
    render(wrap());
    expect(screen.queryByRole("button", { name: /carregar.*exemplo/i })).toBeNull();
  });
});
