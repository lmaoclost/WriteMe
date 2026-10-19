import { afterEach, describe, expect, it } from "vitest";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import {
  LANG_STORAGE_KEY,
  i18n,
  normalizeLanguage,
  readStoredLanguage,
  setLanguage,
} from "./index";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

function flattenValues(value: unknown, prefix = ""): Array<[string, string]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [[prefix, String(value)]];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => flattenValues(child, prefix ? `${prefix}.${key}` : key));
}

afterEach(async () => {
  await setLanguage("en");
  localStorage.clear();
});

describe("locale resources", () => {
  it("pt-BR mirrors every English key", () => {
    expect(flattenKeys(ptBR).sort()).toEqual(flattenKeys(en).sort());
  });

  it("has no empty translations", () => {
    for (const [, value] of [...flattenValues(en), ...flattenValues(ptBR)]) {
      expect(value.trim()).not.toBe("");
    }
  });
});

describe("language preference", () => {
  it("normalizes supported and unsupported values", () => {
    expect(normalizeLanguage("pt-BR")).toBe("pt-BR");
    expect(normalizeLanguage("pt")).toBe("pt-BR");
    expect(normalizeLanguage("fr")).toBe("en");
    expect(normalizeLanguage(null)).toBe("en");
  });

  it("reads the stored language and defaults to English", () => {
    expect(readStoredLanguage()).toBe("en");
    localStorage.setItem(LANG_STORAGE_KEY, "pt-BR");
    expect(readStoredLanguage()).toBe("pt-BR");
    localStorage.setItem(LANG_STORAGE_KEY, "xx");
    expect(readStoredLanguage()).toBe("en");
  });

  it("persists the choice and syncs the document language", async () => {
    await setLanguage("pt-BR");
    expect(i18n.language).toBe("pt-BR");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
    expect(i18n.t("sections.overview.label")).toBe("Visão geral");
  });
});
