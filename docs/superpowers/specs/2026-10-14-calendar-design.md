# Scriptorium — Cronograma/Calendar Design (sub-projeto 5d)

Data: 2026-10-14
> Status: em implementação (plan `2026-10-14-calendar.md`). Calendário custom do mundo — padrões (meses/weekdays custom, eventos por dia com cores/categorias, navegação por anos).

## 1. Modelo (schema v2, opcional)

```ts
type CalendarEvent = { id; text; category: string; color?: string }
type CustomCalendar = {
  id; projectId; name; era?: string;
  months: { name; days: number }[];      // default: 12 meses × 30
  weekdays: string[];                    // default PT: Domingo..Sábado
  weekendDays: number[];                 // default [0, 6]
  events: Record<string, CalendarEvent[]>; // dayKey "y:m:d" (y = índice do ano, 0+)
  startingWeekday: number;               // qual weekday o ano 0 dia 0 cai
  notes: string;
}
```
`ProjectData.calendars?: CustomCalendar[]` — validator quando presente; parseExport normaliza `?? []`; serialize v2 (version mantida).

## 2. Store

`addCalendar(projectId, name = "Calendário sem título")` (mês 1–12 dias 30, weekdays PT, weekend [0,6]) · rename/update/delete + `setCalendarNotes` + history (`pushCLHistory/undoCL/redoCL/selectCLHistoryFlags`, snapshot `{ months, weekdays, weekendDays, era, startingWeekday, events }`) + `addEvent(calendarId, dayKey, { text, category, color })` (text required) + `updateEvent` + `removeEvent` + `setMonth(calendarId, index, patch { name?, days? })` (validating days ≥ 1) + `setEra/setStartingWeekday`.

## 3. UI

- `/p/:projectId/calendar` + `/calendar/:id`; rail: "Calendário" (entre Frações e Livro).
- Página: header (rename, era inline, prev/next year `Y0/Y1...`, config popover (edit mês names/days + weekdays + weekend + startingWeekday), notepad, undo/redo) + grid dos meses do ANO corrente (cards: nome + grid dias; weekday header; weekend cell tint; eventos: pills coloridas (cor por preset); click cell → painel do dia: eventos (edit text/category/color/remover) + add form (text + categoria (Events/Festivals/Notes default PT: "Eventos/Festas/Notas") + cor preset).
- Painel direito igual aos outros.
- Slide navigation? Skip (botões prev/next simples).

## 4. Testes

schema + store paridade (CRUD, addEvent dupe id? — events são independentes: sem guard de dupe; dayKey format), UI: render do ano (12 meses × 30), navegação (yearIndex muda os dayKeys do painel), add/edit/remove event com cor, weekend tint (style/attr), config: renomear mês/dias, undo/redo, export round-trip; smoke browser: criar → adicionar evento → navegação → persistência reload.

## 5. Fora de escopo

chapter links por dia (link a manuscripts — futuro), moon/leap-year custom, tema, slide anim.