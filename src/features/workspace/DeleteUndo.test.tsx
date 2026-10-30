import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRouter } from "../../app/router";
import { useWriteme } from "../../data/store";

beforeEach(() => {
  localStorage.clear();
  useWriteme.setState(useWriteme.getInitialState());
});

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

describe("delete then undo on index pages", () => {
  it("deleting an idea board offers Undo that restores it", async () => {
    const p = useWriteme.getState().addProject("P");
    act(() => { useWriteme.getState().addWellSpring(p.id, "Muse ideas"); });
    await at(`/p/${p.id}/wellspring`);
    fireEvent.click(screen.getByRole("button", { name: /Delete idea board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(useWriteme.getState().wellsprings ?? []).toHaveLength(0);
    const undo = await screen.findByRole("button", { name: "Undo" }, { timeout: 10000 });
    fireEvent.click(undo);
    expect((useWriteme.getState().wellsprings ?? []).map((w) => w.name)).toContain("Muse ideas");
  });

  it("undo offers the book delete on the manuscript page", async () => {
    const p = useWriteme.getState().addProject("P");
    act(() => { useWriteme.getState().addManuscript(p.id, "Cantar de Vellmora"); });
    await at(`/p/${p.id}/manuscript`);
    // two-step confirm; the product re-arms with a REAL 3s disarm timer, which
    // can fire between polls when workers saturate this environment — retry arming
    const deadline = Date.now() + 15000;
    let confirmed = false;
    while (Date.now() < deadline) {
      const confirmBtn = screen.queryByRole("button", { name: "Confirm?" });
      if (confirmBtn) {
        fireEvent.click(confirmBtn);
        confirmed = true;
        break;
      }
      fireEvent.click(screen.getByRole("button", { name: /Delete book/i }));
      await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    }
    expect(confirmed, "delete confirm never appeared").toBe(true);
    await waitFor(() => expect(useWriteme.getState().manuscripts ?? []).toHaveLength(0), { timeout: 10000 });
    const undo = await screen.findByRole("button", { name: "Undo" }, { timeout: 10000 });
    fireEvent.click(undo);
    expect((useWriteme.getState().manuscripts ?? []).map((m) => m.title)).toContain("Cantar de Vellmora");
  }, 25000);

  it("a stale undo toast says so instead of undoing the wrong delete", async () => {
    const p = useWriteme.getState().addProject("P");
    act(() => { useWriteme.getState().addWellSpring(p.id, "A"); });
    act(() => { useWriteme.getState().addConlang(p.id, "B"); });
    await at(`/p/${p.id}/wellspring`);
    fireEvent.click(screen.getByRole("button", { name: /Delete idea board/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("button", { name: "Undo" }, { timeout: 10000 });
    // another delete lands while the first toast is still visible
    act(() => { useWriteme.getState().deleteConlang((useWriteme.getState().conlangs ?? [])[0]!.id); });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await screen.findByText("Nothing left to undo.");
    expect(useWriteme.getState().wellsprings ?? []).toHaveLength(0);
  });
});
