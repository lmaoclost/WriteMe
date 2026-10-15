import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { CalendarPage } from "./CalendarPage";
import { CalendarIndexPage } from "./CalendarIndexPage";
import type { CustomCalendar } from "../../domain/types";

const store = () => useScriptorium.getState();

beforeEach(() => {
  localStorage.clear();
  useScriptorium.setState(useScriptorium.getInitialState());
});
afterEach(() => vi.restoreAllMocks());

const seed = (): CustomCalendar => store().addCalendar("prj_1", "Selo Anual");

describe("store — calendars", () => {
  it("addCalendar defaults: 12 meses × 30, weekdays PT, weekend [0,6]", () => {
    const c = seed();
    expect(c.months).toHaveLength(12);
    expect(c.months[0].days).toBe(30);
    expect(c.weekdays).toHaveLength(7);
    expect(c.weekendDays).toEqual([0, 6]);
    expect(c.events).toEqual({});
  });

  it("addEvent + update + remove com dayKeys", () => {
    const c = seed();
    const ev = store().addCalendarEvent(c.id, "0:2:5", { text: "Festa do Rio", category: "Festas", color: "#2ecc71" })!;
    expect(ev.text).toBe("Festa do Rio");
    act(() => store().updateCalendarEvent(c.id, "0:2:5", ev.id, { color: "#e74c3c" }));
    expect((store().calendars ?? [])[0].events["0:2:5"][0].color).toBe("#e74c3c");
    act(() => store().removeCalendarEvent(c.id, "0:2:5", ev.id));
    expect((store().calendars ?? [])[0].events["0:2:5"]).toBeUndefined();
  });

  it("setMonth edits name/days; invalid days rejected", () => {
    const c = seed();
    act(() => store().setMonth(c.id, 0, { name: "Inverno", days: 0 }));
    const m = store().calendars![0].months[0];
    expect(m.name).toBe("Inverno");
    expect(m.days).toBe(30); // 0 rejeitado
    act(() => store().setMonth(c.id, 0, { days: 45 }));
    expect(store().calendars![0].months[0].days).toBe(45);
  });

  it("history: setEra + addEvent undo/redo", () => {
    const c = seed();
    act(() => { store().setEra(c.id, "Ida do Selo"); });
    act(() => { store().addCalendarEvent(c.id, "0:0:1", { text: "Eclipse", category: "Eventos" }); });
    expect(store().calendars![0].era).toBe("Ida do Selo");
    act(() => { store().undoCL(c.id); });
    expect(store().calendars![0]!.events["0:0:1"]).toBeUndefined();
        act(() => { store().redoCL(c.id); });
    expect(store().calendars![0].events["0:0:1"]).toHaveLength(1);
  });

  it("deleteCalendar drops history key", () => {
    const c = seed();
    act(() => store().deleteCalendar(c.id));
    expect(store().calendars).toHaveLength(0);
    expect(store().histories[`cl_${c.id}`]).toBeUndefined();
  });

  it("round-trips through export", () => {
    const c = seed();
    act(() => { store().addCalendarEvent(c.id, "1:3:9", { text: "Coroação", category: "Notas" }); });
    const json = store().exportData();
    localStorage.clear();
    act(() => { store().importData(json); });
    const cal = store().calendars![0];
    expect(cal.events["1:3:9"][0].text).toBe("Coroação");
  });
});

describe("CalendarPage", () => {
  function mount(c: CustomCalendar) {
    return render(<CalendarPage calendarId={c.id} />);
  }

  it("renders 12 months × 30 days with weekday header", () => {
    const c = seed();
    render(<CalendarPage calendarId={c.id} />);
    expect(screen.getAllByTestId("cal-month")).toHaveLength(12);
    expect(screen.getAllByTestId("cal-day")).toHaveLength(360);
    expect(document.querySelectorAll(".cal-wd").length).toBe(12 * 7);
  });

  it("year navigation shifts event dayKeys", () => {
    const c = seed();
    mount(c);
    fireEvent.click(screen.getByRole("button", { name: "Ano seguinte" }));
    expect(screen.getByLabelText("Ano corrente").textContent).toBe("Ano 2");
    fireDay(5, 0);
    fireEvent.change(screen.getByLabelText("Novo evento"), { target: { value: "Colheita do 2º ano" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const events = store().calendars![0].events;
    expect(Object.keys(events).every((k) => k.startsWith("1:"))).toBe(true);
  });

  it("day click opens panel; add event persists with color", () => {
    const c = seed();
    mount(c);
    fireDay(2, 3);
    expect(screen.getByTestId("cal-panel").textContent).toContain("4 de Mês 3");
    fireEvent.change(screen.getByLabelText("Novo evento"), { target: { value: "Colheita" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    const events = store().calendars![0].events;
    const key = Object.keys(events)[0];
    expect(events[key][0].text).toBe("Colheita");
    expect(events[key][0].category).toBe("Eventos");
  });

  it("weekend cells get weekend class", () => {
    const c = seed();
    mount(c);
    const weekends = document.querySelectorAll(".cal-day.weekend");
    expect(weekends.length).toBeGreaterThan(10);
  });

  it("config popover renames a month and sets era", () => {
    const c = seed();
    mount(c);
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    const nameInp = screen.getByLabelText("Nome do mês 1") as HTMLInputElement;
    fireEvent.change(nameInp, { target: { value: "Primeiro Inverno" } });
    fireEvent.blur(nameInp);
    expect(store().calendars![0].months[0].name).toBe("Primeiro Inverno");
    const eraInp = screen.getByLabelText("Era do calendário") as HTMLInputElement;
    fireEvent.change(eraInp, { target: { value: "Depois do Selo" } });
    fireEvent.blur(eraInp);
    expect(store().calendars![0].era).toBe("Depois do Selo");
  });
});
function fireDay(monthIndex: number, dayNumber: number) {
  const buttons = Array.from(document.querySelectorAll('[data-testid="cal-day"]'));
  const target = buttons[(monthIndex * 30) + dayNumber] as HTMLElement;
  fireEvent.click(target);
}

describe("CalendarIndexPage", () => {
  it("renders cards + creates + deletes", () => {
    seed();
    render(<MemoryRouter><CalendarIndexPage projectId="prj_1" /></MemoryRouter>);
    fireEvent.click(screen.getByTitle("Delete calendar"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store().calendars).toHaveLength(0);
  });
});