import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App scaffold", () => {
  it("renders the app shell", () => {
    render(<App />);
    expect(screen.getByTestId("shell")).toHaveTextContent("Scriptorium");
  });
});