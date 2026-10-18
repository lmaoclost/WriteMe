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

  it("timeline row places date, then dot, then card (card takes the wide column)", () => {
    const projectId = seedProject([{ title: "Guerra", category: "event", date: "1200-05-01" }]);
    render(timelineRoute(projectId));
    const item = document.querySelector(".timeline-item") as HTMLElement;
    const kids = Array.from(item.children).map((c) =>
      c.classList.contains("timeline-dot") ? "dot" : c.tagName === "BUTTON" ? "card" : "date"
    );
    expect(kids).toEqual(["date", "dot", "card"]);
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
    expect(screen.getByLabelText("Title")).toHaveValue("Tratado das Três Pontes");
    expect(screen.getByRole("link", { name: "Codex" }).getAttribute("class")).toContain("text-gold");
  });

  it("uses Tudo as the default chip and Events only narrows the line", () => {
    const projectId = seedProject([
      { title: "Lei do Selo", category: "lore", date: "1300-01" },
      { title: "Tratado das Três Pontes", category: "event", date: "1200-05" },
      { title: "Rio Sarnen", category: "place" },
    ]);
    render(timelineRoute(projectId));
    const so = screen.getByRole("button", { name: "Events only" });
    const tudo = screen.getByRole("button", { name: "Tudo" });
    expect(tudo.getAttribute("aria-pressed")).toBe("true");
    expect(so.getAttribute("aria-pressed")).toBe("false");
    // Tudo default: dated non-events (e.g. casa/faction) already on the line
    expect(cardTitles()).toEqual(["Tratado das Três Pontes", "Lei do Selo"]);
    fireEvent.click(so);
    expect(so.getAttribute("aria-pressed")).toBe("true");
    expect(tudo.getAttribute("aria-pressed")).toBe("false");
    expect(cardTitles()).toEqual(["Tratado das Três Pontes"]);
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
    expect(screen.getByLabelText("Title")).toHaveValue("Portão Sul");
  });

  it("applies the category chip to the Sem data section too", () => {
    const projectId = seedProject([
      { title: "Guerra dos Cinco Invernos", category: "event" },
      { title: "Rio Sarnen", category: "place" },
    ]);
    render(timelineRoute(projectId));
    const section = document.querySelector(".timeline-undated");
    expect(section?.textContent).toContain("Guerra dos Cinco Invernos");
    // Tudo is the default now: undated non-events are listed from the start
    expect(section?.textContent).toContain("Rio Sarnen");
    fireEvent.click(screen.getByRole("button", { name: "Events only" }));
    expect(section?.textContent).not.toContain("Rio Sarnen");
  });

  it("dates render through the project's first configured calendar (month name + era)", () => {
    const project = store().addProject("Vellmora");
    const calendarEntry = store().addEntry(project.id, "event");
    store().updateEntry(calendarEntry.id, { title: "Batalha", date: "1200-05-10" });
    const cal = store().addCalendar(project.id, "Calendário do Arco");
    store().setMonth(cal.id, 4, { name: "Vela" });
    store().setEra(cal.id, "Contagem do Arco");
    render(timelineRoute(project.id));
    const line = mainLine();
    expect(line.getByRole("button", { name: "Batalha — 10 Vela 1200 · Contagem do Arco" })).toBeTruthy();
    // era shows ONCE above the line (a long era would overflow the date column);
    // the date cell itself stays short: day + month + year
    const eras = screen.getAllByTestId("timeline-era");
    expect(eras).toHaveLength(1);
    expect(eras[0].textContent).toBe("Contagem do Arco");
    const cell = (document.querySelector(".timeline-item > span") as HTMLElement).textContent;
    expect(cell).toBe("10 Vela 1200");
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
    const labels = Array.from(document.querySelectorAll("[aria-label='World sections'] a")).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(["← My worlds", "Overview", "Atlas", "Codex", "Timeline", "Bloodline", "Factions", "Calendar", "Plot board", "Timeline canvas", "Oaths", "Wellspring", "Conlang", "Manuscript", "Bindery"]);
    expect(screen.getByRole("link", { name: "Timeline" }).getAttribute("class")).toContain("text-gold");
  });
});
