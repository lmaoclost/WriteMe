import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type MockInstance } from "vitest";
import App from "./App";
import { useScriptorium } from "./data/store";

describe("hydration gate", () => {
  const spies: MockInstance[] = [];
  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
    spies.length = 0;
  });

  it("deep link stays on its route when the store hydrates late (no hub redirect)", async () => {
    // simulate a first render BEFORE persistence finished rehydrating
    spies.push(vi.spyOn(useScriptorium.persist, "hasHydrated").mockReturnValue(false));
    const finishers: Array<() => void> = [];
    spies.push(
      vi.spyOn(useScriptorium.persist, "onFinishHydration").mockImplementation((cb: unknown) => {
        finishers.push(cb as () => void);
        return () => {};
      })
    );

    const pid = useScriptorium.getState().addProject("Vellmora").id;
    window.history.pushState({}, "", `/p/${pid}/entries`);

    render(<App />);

    // while hydrating: splash, never a rendered route
    expect(screen.getByTestId("hydration-splash")).toBeTruthy();
    expect(screen.queryByText("Scriptorium")).toBeNull();

    act(() => finishers.forEach((f) => f()));

    await waitFor(() => expect(screen.getByRole("link", { name: "Codex" })).toBeTruthy());
    expect(window.location.pathname).toBe(`/p/${pid}/entries`);
    // no false "world doesn't exist" toast
    expect(useScriptorium.getState().toasts.some((t) => t.kind === "error")).toBe(false);
  });
});
