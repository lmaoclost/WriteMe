import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AppRouter } from "./app/router";

describe("App shell", () => {
  it("mounts router and shows the library at root", () => {
    render(<App />);
    expect(screen.getByText("Scriptorium")).toBeInTheDocument();
  });

  it("removed site pages (chronicles/updates/settings/profile) redirect home", () => {
    for (const path of ["/chronicles", "/updates", "/settings", "/profile"]) {
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppRouter />
        </MemoryRouter>,
      );
      expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
      cleanup();
    }
  });

  it("public profile deep link (u/:username) also redirects home", () => {
    render(
      <MemoryRouter initialEntries={["/u/renan"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    cleanup();
  });
});
