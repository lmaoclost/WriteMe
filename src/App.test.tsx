import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AppRouter } from "./app/router";

afterEach(() => {
  delete (navigator as { storage?: unknown }).storage;
  localStorage.clear();
});

describe("App shell", () => {
  it("requests persistent storage on boot", async () => {
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { persisted: async () => false, persist },
    });
    render(<App />);
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
  });

  it("mounts router and shows the library at root", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("WriteMe")).toBeInTheDocument());
  });

  it("removed site pages (chronicles/updates/settings/profile) redirect home", async () => {
    for (const path of ["/chronicles", "/updates", "/settings", "/profile"]) {
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppRouter />
        </MemoryRouter>,
      );
      await waitFor(() => expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument());
      cleanup();
    }
  });

  it("public profile deep link (u/:username) also redirects home", async () => {
    render(
      <MemoryRouter initialEntries={["/u/renan"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument());
    cleanup();
  });
});
