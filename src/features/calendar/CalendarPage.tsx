import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { useDebouncedDraft } from "../../ui/useDebouncedDraft";
import type { CustomCalendar } from "../../domain/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "../../ui/Field";
import { Button } from "../../ui/Button";
import { BOARD_HEADER, BOARD_NAME_INPUT, BOARD_ACTIONS, BOARD_ACTION_BTN, BOARD_PANEL, BOARD_PANEL_HINT, BOARD_PANEL_HEAD, BOARD_PANEL_HEAD_H2, BOARD_NOTEPAD, BOARD_NOTEPAD_HEAD, BOARD_NOTEPAD_TXT } from "../../ui/board";
import { useBoardNotesHotkey } from "../../ui/boardNotes";
import { withCurrentColor } from "../../ui/colors";


export const EVENT_CATEGORIES = ["Events", "Festivals", "Notes"] as const;
export const EVENT_PRESET_COLORS = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6", "#1abc9c", "#e84393", "#636e72", "#b2bec3"];

/** Stored category values stay English; only the visible label is localized. */
function EventCategoryLabel({ value }: { value: string }) {
  const { t } = useTranslation();
  if (value === "Events") return <>{t("calendar.eventCategory.events")}</>;
  if (value === "Festivals") return <>{t("calendar.eventCategory.festivals")}</>;
  if (value === "Notes") return <>{t("calendar.eventCategory.notes")}</>;
  return <>{value}</>;
}

const MonthSection = memo(function MonthSection({ month, monthIndex, yearIndex, era, weekdays, weekendDays, firstWeekday, eventsByDay, selectedDay, onSelectDay }: {
  month: CustomCalendar["months"][number];
  monthIndex: number;
  yearIndex: number;
  era?: string;
  weekdays: string[];
  weekendDays: number[];
  firstWeekday: number;
  eventsByDay: Record<number, CustomCalendar["events"][string]>;
  selectedDay: string | null;
  onSelectDay(dayKey: string): void;
}) {
  const { t } = useTranslation();
  const n = weekdays.length;
  return (
    <section className="bg-night border border-line rounded-lg p-3" data-testid="cal-month" aria-label={month.name}>
      <h2 className="text-[1.125rem] mb-2">{era ? t("calendar.page.monthHeading", { month: month.name, year: yearIndex + 1 }) : month.name}</h2>
      <div className="grid gap-0.5 mb-1" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {weekdays.map((w, i) => (
          <span key={i} className={`cal-wd text-[0.6875rem] text-slate text-center uppercase${weekendDays.includes(i) ? " weekend text-[var(--ember)]" : ""}`}>{w.slice(0, 2)}</span>
        ))}
      </div>
      <div className="grid gap-0.5" data-testid="cal-days" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`pad-s-${i}`} data-testid="cal-blank" aria-hidden="true" className="cal-blank aspect-square rounded-sm" />
        ))}
        {Array.from({ length: month.days }, (_, di) => {
          const wd = (firstWeekday + di) % n;
          const key = `${yearIndex}:${monthIndex}:${di}`;
          const evs = eventsByDay[di] ?? [];
          return (
            <button
              key={di}
              type="button"
              data-testid="cal-day"
              className={`cal-day relative aspect-square rounded-sm border border-transparent bg-ink text-parchment-dim text-[11px] p-0.5 grid grid-rows-[auto_1fr] items-start cursor-pointer hover:border-gold-dim${weekendDays.includes(wd) ? " weekend bg-[color-mix(in_srgb,var(--ember)_10%,var(--ink))]" : ""}${selectedDay === key ? " selected border-gold outline outline-1 outline-gold" : ""}`}
              aria-label={t("calendar.page.dayAria", { day: di + 1, month: month.name })}
              onClick={() => onSelectDay(key)}
            >
              <span className="cal-day-num font-mono text-[0.6875rem] text-left">{di + 1}</span>
              <span className="cal-day-events flex flex-wrap gap-0.5 content-start">
                {evs.slice(0, 3).map((e) => (
                  <i key={e.id} className="cal-event-dot w-1.5 h-1.5 rounded-full inline-block" style={{ background: e.color ?? "#636e72" }} />
                ))}
              </span>
            </button>
          );
        })}
        {Array.from({ length: (n - ((firstWeekday + month.days) % n)) % n }, (_, i) => (
          <span key={`pad-e-${i}`} data-testid="cal-blank" aria-hidden="true" className="cal-blank aspect-square rounded-sm" />
        ))}
      </div>
    </section>
  );
});

export function CalendarPage({ calendarId }: { calendarId: string }) {
  const { t } = useTranslation();
  const cal = useScriptorium((s) => (s.calendars ?? []).find((c) => c.id === calendarId));
  const pushToast = useScriptorium((s) => s.pushToast);
  const flags = useScriptorium(useShallow((s) => {
    const h = s.histories[`cl_${calendarId}`];
    return { canUndo: !!h?.undo.length, canRedo: !!h?.redo.length };
  }));
  const [yearIndex, setYearIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  useBoardNotesHotkey(notesOpen, setNotesOpen);

  useEffect(() => {
    if (!cal) pushToast("error", t("calendar.page.notFound"));
  }, [cal, pushToast, t]);

  const nameDraft = useDebouncedDraft(
    cal?.name ?? "",
    (v) => { if (cal && v.trim() && v !== cal.name) useScriptorium.getState().renameCalendar(calendarId, v); },
    300,
  );
  useEffect(() => () => nameDraft.flush(), [nameDraft.flush]);

  // all hooks stay above the early return: hook order must not flip when the
  // calendar disappears mid-mount
  const firstWeekday = useMemo(
    () => (cal
      ? (cal.startingWeekday + yearIndex * cal.months.reduce((acc, m) => acc + m.days, 0)) % cal.weekdays.length
      : 0),
    [cal, yearIndex],
  );

  // per-month event slices, rebuilt only when events/years change — a header
  // rename or selection flip no longer re-renders the 12×30 day grid
  const eventsByMonth = useMemo(() => {
    const slices: Array<Record<number, CustomCalendar["events"][string]>> = [];
    if (!cal) return slices;
    cal.months.forEach((m, mi) => {
      const slice: Record<number, CustomCalendar["events"][string]> = {};
      for (let di = 0; di < m.days; di++) {
        const evs = cal.events[`${yearIndex}:${mi}:${di}`];
        if (evs && evs.length) slice[di] = evs;
      }
      slices[mi] = slice;
    });
    return slices;
  }, [cal, yearIndex]);

  const onSelectDay = useCallback((dayKey: string) => setSelectedDay(dayKey), []);

  if (!cal) return null;

  const store = useScriptorium.getState;

  return (
    <div className="grid grid-rows-[auto_1fr] h-full" data-testid="calendar-page">
      <header className={BOARD_HEADER}>
        <input
          className={BOARD_NAME_INPUT}
          aria-label={t("calendar.page.name")}
          value={nameDraft.draft}
          onChange={(e) => nameDraft.setDraft(e.target.value)}
          onBlur={() => nameDraft.flush()}
        />
        <span className="text-slate text-[13px]">{cal.era ?? ""}</span>
        <div className={BOARD_ACTIONS}>
          <button type="button" aria-label={t("calendar.page.prevYear")} className={BOARD_ACTION_BTN} onClick={() => setYearIndex((y) => Math.max(0, y - 1))} disabled={yearIndex === 0}>‹</button>
          <output aria-label={t("calendar.page.currentYear")} className="cal-year text-gold font-mono">{t("calendar.page.year", { year: yearIndex + 1 })}</output>
          <button type="button" aria-label={t("calendar.page.nextYear")} className={BOARD_ACTION_BTN} onClick={() => setYearIndex((y) => y + 1)}>›</button>
          <button type="button" aria-label={t("calendar.page.undo")} className={BOARD_ACTION_BTN} disabled={!flags.canUndo} onClick={() => store().undoCL(calendarId)}>↶</button>
          <button type="button" aria-label={t("calendar.page.redo")} className={BOARD_ACTION_BTN} disabled={!flags.canRedo} onClick={() => store().redoCL(calendarId)}>↷</button>
          <button type="button" className={BOARD_ACTION_BTN} onClick={() => setConfigOpen(true)}>{t("calendar.page.settings")}</button>
          <button type="button" aria-pressed={notesOpen} className={BOARD_ACTION_BTN} onClick={() => setNotesOpen((v) => !v)}>{t("calendar.page.notes")}</button>
        </div>
      </header>
      <div className="grid grid-cols-[1fr_300px] min-h-0 overflow-hidden">
        <div className="overflow-y-auto p-5 grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 content-start" data-testid="cal-year-grid">
          {cal.months.map((m, mi) => (
            <MonthSection
              key={mi}
              month={m}
              monthIndex={mi}
              yearIndex={yearIndex}
              era={cal.era}
              weekdays={cal.weekdays}
              weekendDays={cal.weekendDays}
              firstWeekday={firstWeekday}
              eventsByDay={eventsByMonth[mi]}
              selectedDay={selectedDay}
              onSelectDay={onSelectDay}
            />
          ))}
        </div>
        <DayPanel
          cal={cal}
          dayKey={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
        {configOpen ? <ConfigPopover cal={cal} onClose={() => setConfigOpen(false)} /> : null}
        {notesOpen ? <CalNotepad notes={cal.notes} onNotes={(v) => store().setCalendarNotes(calendarId, v)} onClose={() => setNotesOpen(false)} /> : null}
      </div>
    </div>
  );
}

function DayPanel({ cal, dayKey, onClose }: {
  cal: CustomCalendar;
  dayKey: string | null;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const store = useScriptorium.getState;
  const events = dayKey ? (cal.events[dayKey] ?? []) : [];
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>(EVENT_CATEGORIES[0]);
  const [color, setColor] = useState(EVENT_PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dayLabel = useMemo(() => {
    if (!dayKey) return "";
    const [y, m, d] = dayKey.split(":").map(Number);
    return t("calendar.page.dayLabel", { day: d + 1, month: cal.months[m]?.name ?? "?", year: y + 1 });
  }, [dayKey, cal, t]);

  if (!dayKey) {
    return (
      <aside className={BOARD_PANEL} data-testid="cal-panel">
        <p className={BOARD_PANEL_HINT}>{t("calendar.day.selectHint")}</p>
      </aside>
    );
  }
  return (
    <aside className={BOARD_PANEL} data-testid="cal-panel">
      <header className={BOARD_PANEL_HEAD}>
        <h2 className={BOARD_PANEL_HEAD_H2}>{dayLabel}</h2>
        <button type="button" aria-label={t("calendar.day.close")} onClick={onClose} className="bg-none border-0 text-slate">✕</button>
      </header>
      <ul className="list-none m-0 p-0 grid gap-2.5">
        {events.map((e) => (
          <li key={e.id} className="grid grid-cols-[auto_1fr] gap-1.5 items-center [&>*:nth-child(n+3)]:col-span-full">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color ?? "#636e72" }} />
            {editingId === e.id ? (
              <input
                aria-label={t("calendar.day.eventText")}
                value={e.text}
                autoFocus
                onChange={(ev) => store().updateCalendarEvent(cal.id, dayKey, e.id, { text: ev.target.value })}
                onKeyDown={(ev) => { if (ev.key === "Enter") setEditingId(null); }}
              />
            ) : (
              <button type="button" className="cal-event-text bg-none border-0 text-parchment text-left text-[13px] p-0" onClick={() => setEditingId(e.id)} aria-label={t("calendar.day.editEvent", { text: e.text })}>
                {e.text}
              </button>
            )}
            <Select value={e.category} onValueChange={(v) => store().updateCalendarEvent(cal.id, dayKey, e.id, { category: v })}>
              <SelectTrigger aria-label={t("calendar.day.categoryOf", { text: e.text })} className="justify-self-start h-auto rounded-sm border-line bg-ink px-1 py-0.5 text-[11px] text-parchment-dim hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
              <SelectContent className="border-line bg-night text-parchment">
                {EVENT_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-[11px] focus:bg-[#24233f] focus:text-parchment"><EventCategoryLabel value={c} /></SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              {withCurrentColor(EVENT_PRESET_COLORS, e.color).map((c) => (
                <button key={c} type="button" className={`color-swatch w-3.5 h-3.5 rounded-full border border-transparent cursor-pointer${e.color === c ? " outline outline-2 outline-parchment" : ""}`} style={{ background: c }} aria-label={t("calendar.day.colorOf", { color: c })} onClick={() => store().updateCalendarEvent(cal.id, dayKey, e.id, { color: c })} />
              ))}
            </div>
            <Button kind="danger" className="px-1.5 py-0.5 text-xs" aria-label={t("calendar.day.removeEvent", { text: e.text })} onClick={() => store().removeCalendarEvent(cal.id, dayKey, e.id)}>✕</Button>
          </li>
        ))}
        {events.length === 0 ? <li className="text-slate">{t("calendar.day.empty")}</li> : null}
      </ul>
      <form
        className="grid gap-1.5 mt-3.5 border-t border-line pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const ev = store().addCalendarEvent(cal.id, dayKey, { text, category, color });
          if (ev) { setText(""); setColor(EVENT_PRESET_COLORS[0]); }
        }}
      >
        <input aria-label={t("calendar.day.newEvent")} placeholder={t("calendar.day.newEventPlaceholder")} value={text} onChange={(e) => setText(e.target.value)} className="bg-ink border border-line text-parchment rounded-sm px-2 py-1.5" />
        <Select value={category} onValueChange={(v) => setCategory(v)}>
          <SelectTrigger aria-label={t("calendar.day.category")} className="justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
          <SelectContent className="border-line bg-night text-parchment">
            {EVENT_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs focus:bg-[#24233f] focus:text-parchment"><EventCategoryLabel value={c} /></SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit">{t("calendar.day.add")}</Button>
      </form>
    </aside>
  );
}

function FirstDayPicker({ cal }: { cal: CustomCalendar }) {
  const { t } = useTranslation();
  const [first, setFirst] = useState(String(cal.startingWeekday));
  return (
    <Select value={first} onValueChange={(v) => { setFirst(v); useScriptorium.getState().setStartingWeekday(cal.id, Number(v)); }}>
      <SelectTrigger aria-label={t("calendar.config.firstDayAria")} className="w-full justify-between rounded-sm border-line bg-ink px-2 py-1.5 text-xs text-parchment hover:border-gold-dim data-[size=default]:h-auto"><SelectValue /></SelectTrigger>
      <SelectContent className="border-line bg-night text-parchment">
        {cal.weekdays.map((w, i) => <SelectItem key={i} value={String(i)} className="text-xs focus:bg-[#24233f] focus:text-parchment">{w}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ConfigPopover({ cal, onClose }: { cal: CustomCalendar; onClose(): void }) {
  const { t } = useTranslation();
  const store = useScriptorium.getState;
  const [newMonth, setNewMonth] = useState("");
  const [newMonthDays, setNewMonthDays] = useState(30);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="absolute top-[60px] right-[320px] z-45 w-[280px] max-w-[calc(100vw-1.5rem)] max-[720px]:inset-x-3 max-[720px]:top-[52px] max-h-[70vh] overflow-y-auto bg-night-2 border border-line rounded-lg p-3.5 grid gap-2.5" data-testid="cal-config" role="dialog" aria-label={t("calendar.config.title")}>
      <header className={BOARD_PANEL_HEAD}>
        <h2>{t("calendar.config.eraSection")}</h2>
        <button type="button" aria-label={t("calendar.config.close")} onClick={onClose} className="bg-none border-0 text-slate">✕</button>
      </header>
      <Field label={t("calendar.config.eraLabel")}>
        <input
          aria-label={t("calendar.config.eraAria")}
          defaultValue={cal.era ?? ""}
          onBlur={(e) => store().setEra(cal.id, e.target.value.trim() || undefined)}
        />
      </Field>
      <Field label={t("calendar.config.firstDayLabel")}>
        <FirstDayPicker cal={cal} />
      </Field>
      <section>
        <h3 className="text-[13px] text-slate">{t("calendar.config.weekdays")}</h3>
        <ul className="grid gap-1 [&_li]:grid-cols-[28px_1fr_auto] [&_li]:items-center [&_input]:bg-ink [&_input]:border [&_input]:border-line [&_input]:text-parchment [&_input]:px-1.5 [&_input]:py-1 [&_input]:text-xs [&_li]:grid-cols-[28px_1fr_auto]" data-testid="cal-weekdays-config">
          {cal.weekdays.map((w, i) => (
            <li key={i}>
              <span className="text-slate">{t("calendar.config.index", { n: i + 1 })}</span>
              <input
                aria-label={t("calendar.config.weekdayAria", { n: i + 1 })}
                placeholder={t("calendar.config.weekdayPlaceholder")}
                defaultValue={w}
                className="bg-ink border border-line text-parchment px-1.5 py-1 text-xs w-full min-w-0"
                onBlur={(e) => {
                  const next = cal.weekdays.slice();
                  next[i] = e.target.value.trim();
                  store().setWeekdays(cal.id, next);
                }}
              />
              <label className="flex items-center gap-1 text-[11px] text-slate" title={t("calendar.config.weekendTitle")}>
                <input
                  type="checkbox"
                  aria-label={t("calendar.config.weekendAria", { n: i + 1 })}
                  checked={(cal.weekendDays ?? [0, 6]).includes(i)}
                  onChange={(e) => {
                    const cur = new Set(cal.weekendDays ?? [0, 6]);
                    if (e.target.checked) cur.add(i); else cur.delete(i);
                    store().setWeekendDays(cal.id, [...cur]);
                  }}
                />
                <span>{t("calendar.config.weekend")}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-[13px] text-slate">{t("calendar.config.months")}</h3>
        <ul className="grid gap-1 [&_li]:grid-cols-[1.4fr_64px_auto] [&_li]:items-center [&_input]:bg-ink [&_input]:border [&_input]:border-line [&_input]:text-parchment [&_input]:px-1.5 [&_input]:py-1 [&_input]:text-xs">
          {cal.months.map((m, i) => (
            <li key={i}>
              <input
                aria-label={t("calendar.config.monthNameAria", { n: i + 1 })}
                placeholder={t("calendar.config.monthNamePlaceholder")}
                defaultValue={m.name}
                className="bg-ink border border-line text-parchment px-1.5 py-1 text-xs w-full min-w-0"
                onBlur={(e) => store().setMonth(cal.id, i, { name: e.target.value })}
              />
              <input
                type="number"
                min={1}
                aria-label={t("calendar.config.daysOf", { n: i + 1 })}
                defaultValue={m.days}
                className="bg-ink border border-line text-parchment px-1.5 py-1 text-xs w-full min-w-0"
                onBlur={(e) => store().setMonth(cal.id, i, { days: Number(e.target.value) })}
              />
              {cal.months.length > 1 ? (
                <button type="button" aria-label={t("calendar.config.removeMonth", { n: i + 1 })} className="cal-month-remove bg-none border-0 text-slate cursor-pointer px-1.5 py-1 text-xs hover:text-[var(--ember)]"
                  onClick={() => { store().removeMonth(cal.id, i); onClose(); }}>✕</button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-[1.4fr_64px_auto] gap-1.5 mt-2 [&>input]:w-full [&>input]:min-w-0 [&>input]:bg-ink [&>input]:border [&>input]:border-line [&>input]:text-parchment [&>input]:px-1.5 [&>input]:py-1 [&>input]:text-xs" data-testid="cal-month-add">
          <input aria-label={t("calendar.config.newMonthName")} placeholder={t("calendar.config.newMonthPlaceholder")} value={newMonth}
            onChange={(e) => setNewMonth(e.target.value)} />
          <input aria-label={t("calendar.config.newMonthDays")} type="number" min={1} placeholder={t("calendar.config.daysPlaceholder")} value={newMonthDays}
            onChange={(e) => setNewMonthDays(Number(e.target.value))} />
          <button
            type="button"
            onClick={() => {
              if (newMonth.trim()) { store().addMonth(cal.id, newMonth.trim(), newMonthDays || 30); onClose(); }
            }}
          className="bg-ink border border-line text-parchment cursor-pointer px-2.5 py-1 text-xs hover:text-gold hover:border-gold-dim"
          >{t("calendar.config.addMonth")}</button>
        </div>
      </section>
    </div>
  );
}

function CalNotepad({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(notes);
  useEffect(() => {
    const id = setTimeout(() => { if (draft !== notes) onNotes(draft); }, 300);
    return () => clearTimeout(id);
  }, [draft, notes, onNotes]);
  return (
    <div className={BOARD_NOTEPAD} data-testid="cal-notepad">
      <header className={BOARD_NOTEPAD_HEAD}>
        <span>{t("calendar.notepad.title")}</span>
        <button type="button" aria-label={t("calendar.notepad.close")} onClick={onClose} className="bg-none border-0 text-slate">✕</button>
      </header>
      <textarea aria-label={t("calendar.notepad.aria")} value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} className={BOARD_NOTEPAD_TXT} />
    </div>
  );
}
