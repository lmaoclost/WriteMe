import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App shell", () => {
  it("mounts router and shows the library at root", () => {
    render(<App />);
    expect(screen.getByText(/Scriptorium/)).toBeInTheDocument();
  });
});