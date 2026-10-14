import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRouter } from "../../app/router";
import { useScriptorium } from "../../data/store";
import type { EntryCategory } from "../../domain/types";

type EntrySpec = { title: string; category: EntryCategory; body?: string; date?: string };

const store = () => useScriptorium.getState();

function seedProject(specs: EntrySpec[]): string {
  const project = store().addProject("Vellmora");
  for (const spec of specs) {
    const entry = store().addEntry(project.id, spec.category);
    store().updateEntry(entry.id, {
      title: spec.title,
      ...(spec.body !== undefined ? { body: spec.body } : {}),
      ...(spec.date !== undefined ? { date: spec.date } : {}),
    });
  }
  return project.id;
}

function timelineRoute(projectId: string) {
  return (
    <MemoryRouter initialEntries={[`/p/${projectId}/timeline`]}>
      <AppRouter />
    </MemoryRouter>
  );
}

function mainLine() {
  const line = document.querySelector(".timeline");
  expect(line, "main .timeline should be rendered").toBeTruthy();
  return within(line as HTMLElement);
}

function cardTitles(): string[] {
  const cards = document.querySelectorAll(
    ".timeline .timeline-card .timeline-card-title",
  );
  return Array.from(cards).map((el) => el.textContent ?? "");
}

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});

describe("TimelinePage", () => {
  it("orders the main line by dateKey ascending and keeps undated entries out of it", () => {
    const projectId = seedProject([
      { title: "Guerra dos Cinco Invernos", category: "event", body: "Cerco de um inverno." },
      { title: "Tratado das Três Pontes", category: "event", date: "1200-05" },
      { title: "Batalha de Sarnen", category: "event", date: "1200-05-10" },
      { title: "Fundação de Vellmora", category: "event", date: "1100" },
    ]);
    render(timelineRoute(projectId));
    expect(cardTitles()).toEqual([
      "Fundação de Vellmora",
      "Tratado das Três Pontes",
      "Batalha de Sarnen",
    ]);
    const line = mainLine();
    expect(line.getByRole("button", { name: "Fundação de Vellmora — 1100" })).toBeTruthy();
    expect(line.getByRole("button", { name: "Tratado das Três Pontes — 1200 · Maio" })).toBeTruthy();
    expect(line.getByRole("button", { name: "Batalha de Sarnen — 10 de Maio de 1200" })).toBeTruthy();
    expect(
      within(document.querySelector(".timeline") as HTMLElement).queryByText("Guerra dos Cinco Invernos"),
    ).toBeNull();
  });

  it("renders the formatted date column and card snippet from the first body line", () => {
    const projectId = seedProject([
      {
        title: "Tratado das Três Pontes",
        category: "event",
        date: "1200-05",
        body: `As três pontes assinam a paz.\nSegunda linha ignorada. ${"x".repeat(200)}`,
      },
    ]);
    render(timelineRoute(projectId));
    expect(screen.getByText("1200 · Maio")).toBeTruthy();
    const snippet = document.querySelector(".timeline-card-body");
    const firstLine = "As três pontes assinam a paz.";
    expect(snippet?.textContent?.startsWith(firstLine)).toBe(true);
    expect((snippet?.textContent ?? "").length).toBeLessThanOrEqual(121);
  });

  it("navigates to the codex with the entry selected on card click", () => {
    const projectId = seedProject([
      { title: "Batalha de Sarnen", category: "event", date: "1200-05-10" },
      { title: "Tratado das Três Pontes", category: "event", date: "1200-05" },
    ]);
    render(timelineRoute(projectId));
    fireEvent.click(screen.getByRole("button", { name: "Tratado das Três Pontes — 1200 · Maio" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Tratado das Três Pontes");
    expect(screen.getByRole("link", { name: "Códex" }).getAttribute("class")).toContain("active");
  });

  it("uses Só eventos as the default chip and Tudo reveals dated non-events", () => {
    const projectId = seedProject([
      { title: "Lei do Selo", category: "lore", date: "1300-01" },
      { title: "Tratado das Três Pontes", category: "event", date: "1200-05" },
      { title: "Rio Sarnen", category: "place" },
    ]);
    render(timelineRoute(projectId));
    const so = screen.getByRole("button", { name: "Só eventos" });
    const tudo = screen.getByRole("button", { name: "Tudo" });
    expect(so.getAttribute("aria-pressed")).toBe("true");
    expect(tudo.getAttribute("aria-pressed")).toBe("false");
    expect(cardTitles()).toEqual(["Tratado das Três Pontes"]);
    fireEvent.click(tudo);
    expect(so.getAttribute("aria-pressed")).toBe("false");
    expect(tudo.getAttribute("aria-pressed")).toBe("true");
    expect(cardTitles()).toEqual(["Tratado das Três Pontes", "Lei do Selo"]);
  });

  it("lists undated entries and corrupted dates in the final section with warning dots", () => {
    const projectId = seedProject([
      { title: "Tratado das Três Pontes", category: "event", date: "1200-05" },
      { title: "Guerra dos Cinco Invernos", category: "event" },
      { title: "Portão Sul", category: "event", date: "1200-13" },
    ]);
    render(timelineRoute(projectId));
    const section = document.querySelector(".timeline-undated");
    expect(section).toBeTruthy();
    const rows = within(section as HTMLElement);
    expect(rows.getByRole("button", { name: "Guerra dos Cinco Invernos" })).toBeTruthy();
    expect(rows.getByRole("button", { name: "Portão Sul" })).toBeTruthy();
    const guerra = rows.getByRole("button", { name: "Guerra dos Cinco Invernos" });
    const portao = rows.getByRole("button", { name: "Portão Sul" });
    expect(guerra.querySelector(".codex-dot")).toHaveStyle({ backgroundColor: "#7a7a99" });
    expect(portao.querySelector(".codex-dot")).toHaveStyle({ backgroundColor: "#a64b35" });
    fireEvent.click(rows.getByRole("button", { name: "Portão Sul" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Portão Sul");
  });

  it("applies the category chip to the Sem data section too", () => {
    const projectId = seedProject([
      { title: "Guerra dos Cinco Invernos", category: "event" },
      { title: "Rio Sarnen", category: "place" },
    ]);
    render(timelineRoute(projectId));
    const section = document.querySelector(".timeline-undated");
    expect(section?.textContent).toContain("Guerra dos Cinco Invernos");
    expect(section?.textContent).not.toContain("Rio Sarnen");
    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    expect(document.querySelector(".timeline-undated")?.textContent).toContain("Rio Sarnen");
  });

  it("shows the empty copy when no filtered entry has a valid date", () => {
    const projectId = seedProject([
      { title: "Guerra dos Cinco Invernos", category: "event" },
      { title: "Portão Sul", category: "event", date: "1200-13" },
    ]);
    render(timelineRoute(projectId));
    expect(
      screen.getByText("Nenhum evento com data — edite uma entrada de evento e defina a data."),
    ).toBeTruthy();
    expect(document.querySelector(".timeline")).toBeNull();
  });

  it("colors dots by category (event ember) and renders the rail item between Códex and Livro", () => {
    const projectId = seedProject([
      { title: "Tratado das Três Pontes", category: "event", date: "1200-05" },
      { title: "Lei do Selo", category: "lore", date: "1300-01" },
    ]);
    render(timelineRoute(projectId));
    const tratado = mainLine().getByRole("button", { name: "Tratado das Três Pontes — 1200 · Maio" });
    const item = tratado.closest(".timeline-item") as HTMLElement;
    expect(item.querySelector(".timeline-dot")).toHaveStyle({ backgroundColor: "#a64b35" });
    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    const lei = mainLine().getByRole("button", { name: "Lei do Selo — 1300 · Janeiro" });
    const loreItem = lei.closest(".timeline-item") as HTMLElement;
    expect(loreItem.querySelector(".timeline-dot")).toHaveStyle({ backgroundColor: "#4d8f5f" });
    const labels = Array.from(document.querySelectorAll(".rail-link .rail-label")).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(["Visão Geral", "Atlas", "Códex", "Cronologia", "Linhagem", "Livro"]);
    expect(screen.getByRole("link", { name: "Cronologia" }).getAttribute("class")).toContain("active");
  });
});
