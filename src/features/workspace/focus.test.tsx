import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
