import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageToggle } from "./LanguageToggle";
import { LANG_STORAGE_KEY, i18n, setLanguage } from "../i18n";

afterEach(async () => {
  await setLanguage("en");
  localStorage.clear();
});

describe("LanguageToggle", () => {
  it("shows the language it will switch to", async () => {
    render(<LanguageToggle />);
    const button = screen.getByRole("button", { name: "Switch to Portuguese" });
    expect(button).toHaveTextContent("PT");
    await waitFor(() => expect(i18n.language).toBe("en"));
  });

  it("switches to Portuguese, persists it and updates the document language", async () => {
    render(<LanguageToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to Portuguese" }));

    await waitFor(() => expect(i18n.language).toBe("pt-BR"));
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
    const button = screen.getByRole("button", { name: "Mudar para inglês" });
    expect(button).toHaveTextContent("EN");
  });

  it("toggles back to English", async () => {
    await setLanguage("pt-BR");
    render(<LanguageToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Mudar para inglês" }));

    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("button", { name: "Switch to Portuguese" })).toHaveTextContent("PT");
  });
});
