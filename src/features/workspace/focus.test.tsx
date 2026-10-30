import { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../../app/router";
import { useWriteme } from "../../data/store";
import { FocusContext, FocusToggle, isWritingPath } from "./focus";

describe("isWritingPath", () => {
  it("recognizes the three writing routes", () => {
    expect(isWritingPath("/p/p1/manuscript")).toBe(true);
    expect(isWritingPath("/p/p1/bindery/m1")).toBe(true);
    expect(isWritingPath("/p/p1/wellspring/w1")).toBe(true);
  });

  it("rejects overviews and index lists", () => {
    expect(isWritingPath("/p/p1")).toBe(false);
    expect(isWritingPath("/p/p1/entries")).toBe(false);
    expect(isWritingPath("/p/p1/bindery")).toBe(false);
    expect(isWritingPath("/p/p1/wellspring")).toBe(false);
  });

  it("normalizes trailing slashes", () => {
    expect(isWritingPath("/p/p1/manuscript/")).toBe(true);
    expect(isWritingPath("/p/p1/bindery/m1/")).toBe(true);
    expect(isWritingPath("/p/p1/wellspring/w1/")).toBe(true);
    expect(isWritingPath("/p/p1/bindery/")).toBe(false);
  });
});

describe("FocusToggle", () => {
  it("renders nothing outside a focus provider", () => {
    render(<FocusToggle />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows Focus when off, Exit focus when on, and delegates clicks", () => {
    const toggle = vi.fn();
    const { rerender } = render(
      <FocusContext.Provider value={{ focus: false, toggle, exit: vi.fn() }}>
        <FocusToggle />
      </FocusContext.Provider>,
    );
    const off = screen.getByRole("button", { name: "Focus" });
    expect(off).toHaveAttribute("aria-pressed", "false");
    expect(off).toHaveAttribute("aria-keyshortcuts", "Control+Shift+F");
    fireEvent.click(off);
    expect(toggle).toHaveBeenCalledTimes(1);

    rerender(
      <FocusContext.Provider value={{ focus: true, toggle, exit: vi.fn() }}>
        <FocusToggle />
      </FocusContext.Provider>,
    );
    const on = screen.getByRole("button", { name: "Exit focus" });
    expect(on).toHaveAttribute("aria-pressed", "true");
  });
});

async function at(path: string, extra?: ReactNode): Promise<void> {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
      {extra}
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.queryByTestId("hydration-splash")).toBeNull();
    expect(screen.queryByTestId("chunk-splash")).toBeNull();
  }, { timeout: 10000 });
}

const rail = () =>
  screen.queryByRole("navigation", { name: /world sections/i });

beforeEach(() => {
  localStorage.clear();
  useWriteme.setState(useWriteme.getInitialState());
});

describe("focus mode", () => {
  it("hides the rail on Ctrl+Shift+F and restores it with Esc", async () => {
    const p = useWriteme.getState().addProject("Focus World");
    await at(`/p/${p.id}/manuscript`);
    expect(rail()).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "F", ctrlKey: true, shiftKey: true });
    expect(rail()).toBeNull();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(rail()).toBeInTheDocument();
  });

  it("ignores the shortcut outside writing routes", async () => {
    const p = useWriteme.getState().addProject("Calm");
    await at(`/p/${p.id}/entries`);
    fireEvent.keyDown(document.body, { key: "F", ctrlKey: true, shiftKey: true });
    expect(rail()).toBeInTheDocument();
  });

  it("ignores auto-repeated keydowns", async () => {
    const p = useWriteme.getState().addProject("Steady");
    await at(`/p/${p.id}/manuscript`);
    expect(rail()).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "F", ctrlKey: true, shiftKey: true, repeat: true });
    expect(rail()).toBeInTheDocument();
  });

  it("drops focus when navigating to another page", async () => {
    const p = useWriteme.getState().addProject("Wanderer");
    await at(`/p/${p.id}/manuscript`, <Link to={`/p/${p.id}/entries`}>elsewhere</Link>);

    fireEvent.keyDown(document.body, { key: "F", ctrlKey: true, shiftKey: true });
    expect(rail()).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "elsewhere" }));
    await waitFor(() => expect(rail()).toBeInTheDocument());
  });

  it("turns focus on from the page button and back off again", async () => {
    const p = useWriteme.getState().addProject("Ink");
    const m = useWriteme.getState().addManuscript(p.id);
    await at(`/p/${p.id}/bindery/${m.id}`);

    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    expect(rail()).toBeNull();
    expect(screen.getByRole("button", { name: "Exit focus" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Exit focus" }));
    expect(rail()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Focus" })).toHaveAttribute("aria-pressed", "false");
  });
});
