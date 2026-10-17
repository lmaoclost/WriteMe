import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import type { CustomCalendar } from "../../domain/types";
import "./calendar.css";import { useBoardNotesHotkey } from "../../ui/boardNotes";


export const EVENT_CATEGORIES = ["Events", "Festivals", "Notes"] as const;
export const EVENT_PRESET_COLORS = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6", "#1abc9c", "#e84393", "#636e72", "#b2bec3"];

export function CalendarPage({ calendarId }: { calendarId: string }) {
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
    if (!cal) pushToast("error", "Calendar not found.");
  }, [cal, pushToast]);

  if (!cal) return null;

  const dayKey = (m: number, d: number) => `${yearIndex}:${m}:${d}`;
  const firstWeekday = (cal.startingWeekday + yearIndex * cal.months.reduce((acc, m) => acc + m.days, 0)) % cal.weekdays.length;

  const store = useScriptorium.getState;

  return (
    <div className="calendar-page" data-testid="calendar-page">
      <header className="bl-header">
        <input
          className="bl-name"
          aria-label="Calendar name"
          value={cal.name}
          onChange={(e) => store().renameCalendar(calendarId, e.target.value)}
        />
        <span className="cal-era">{cal.era ?? ""}</span>
        <div className="bl-actions">
          <button type="button" aria-label="Previous year" onClick={() => setYearIndex((y) => Math.max(0, y - 1))} disabled={yearIndex === 0}>‹</button>
          <output aria-label="Current year" className="cal-year">Year {yearIndex + 1}</output>
          <button type="button" aria-label="Next year" onClick={() => setYearIndex((y) => y + 1)}>›</button>
          <button type="button" aria-label="Desfazer" disabled={!flags.canUndo} onClick={() => store().undoCL(calendarId)}>↶</button>
          <button type="button" aria-label="Refazer" disabled={!flags.canRedo} onClick={() => store().redoCL(calendarId)}>↷</button>
          <button type="button" onClick={() => setConfigOpen(true)}>Edit Calendar Settings</button>
          <button type="button" aria-pressed={notesOpen} onClick={() => setNotesOpen((v) => !v)}>Notes ✎</button>
        </div>
      </header>
      <div className="bl-body">
        <div className="cal-year-grid" data-testid="cal-year-grid">
          {cal.months.map((m, mi) => (
            <section key={mi} className="cal-month" data-testid="cal-month" aria-label={m.name}>
              <h2>{m.name}{cal.era ? ` · A${yearIndex + 1}` : ""}</h2>
              <div className="cal-weekdays" aria-hidden="true">
                {cal.weekdays.map((w, i) => (
                  <span key={i} className={`cal-wd${cal.weekendDays.includes(i) ? " weekend" : ""}`}>{w.slice(0, 2)}</span>
                ))}
              </div>
              <div className="cal-days" style={{ gridTemplateRows: undefined }}>
                {Array.from({ length: m.days }, (_, di) => {
                  const wd = (firstWeekday + di) % cal.weekdays.length;
                  const key = dayKey(mi, di);
                  const evs = cal.events[key] ?? [];
                  return (
                    <button
                      key={di}
                      type="button"
                      data-testid="cal-day"
                      className={`cal-day${cal.weekendDays.includes(wd) ? " weekend" : ""}${selectedDay === key ? " selected" : ""}`}
                      aria-label={`${di + 1} de ${m.name}`}
                      onClick={() => setSelectedDay(key)}
                    >
                      <span className="cal-day-num">{di + 1}</span>
                      <span className="cal-day-events">
                        {evs.slice(0, 3).map((e) => (
                          <i key={e.id} className="cal-event-dot" style={{ background: e.color ?? "#636e72" }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
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
  const store = useScriptorium.getState;
  const events = dayKey ? (cal.events[dayKey] ?? []) : [];
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>(EVENT_CATEGORIES[0]);
  const [color, setColor] = useState(EVENT_PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const dayLabel = useMemo(() => {
    if (!dayKey) return "";
    const [y, m, d] = dayKey.split(":").map(Number);
    return `${d + 1} of ${cal.months[m]?.name ?? "?"} · Year ${y + 1}`;
  }, [dayKey, cal]);

  if (!dayKey) {
    return (
      <aside className="bl-panel" data-testid="cal-panel">
        <p className="bl-panel-hint">Clique num dia para os eventos dele.</p>
      </aside>
    );
  }
  return (
    <aside className="bl-panel" data-testid="cal-panel">
      <header className="bl-panel-head">
        <h2>{dayLabel}</h2>
        <button type="button" aria-label="Close day" onClick={onClose}>✕</button>
      </header>
      <ul className="cal-event-list">
        {events.map((e) => (
          <li key={e.id} className="cal-event-item">
            <span className="cal-event-dot" style={{ background: e.color ?? "#636e72" }} />
            {editingId === e.id ? (
              <input
                aria-label="Event text"
                value={e.text}
                autoFocus
                onChange={(ev) => store().updateCalendarEvent(cal.id, dayKey, e.id, { text: ev.target.value })}
                onKeyDown={(ev) => { if (ev.key === "Enter") setEditingId(null); }}
              />
            ) : (
              <button type="button" className="cal-event-text" onClick={() => setEditingId(e.id)} aria-label={`Editar ${e.text}`}>
                {e.text}
              </button>
            )}
            <select
              aria-label={`Categoria de ${e.text}`}
              value={e.category}
              onChange={(ev) => store().updateCalendarEvent(cal.id, dayKey, e.id, { category: ev.target.value })}
            >
              {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="cal-event-colors">
              {EVENT_PRESET_COLORS.map((c) => (
                <button key={c} type="button" className={`color-swatch${e.color === c ? " current" : ""}`} style={{ background: c }} aria-label={`Cor ${c}`} onClick={() => store().updateCalendarEvent(cal.id, dayKey, e.id, { color: c })} />
              ))}
            </div>
            <button type="button" className="btn-danger" aria-label={`Remover ${e.text}`} onClick={() => store().removeCalendarEvent(cal.id, dayKey, e.id)}>✕</button>
          </li>
        ))}
        {events.length === 0 ? <li className="dim">Nenhum evento nesse dia.</li> : null}
      </ul>
      <form
        className="cal-event-add"
        onSubmit={(e) => {
          e.preventDefault();
          const ev = store().addCalendarEvent(cal.id, dayKey, { text, category, color });
          if (ev) { setText(""); setColor(EVENT_PRESET_COLORS[0]); }
        }}
      >
        <input aria-label="New event" placeholder="New event..." value={text} onChange={(e) => setText(e.target.value)} />
        <select aria-label="Event category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit">Add</button>
      </form>
    </aside>
  );
}

function ConfigPopover({ cal, onClose }: { cal: CustomCalendar; onClose(): void }) {
  const store = useScriptorium.getState;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="cal-config" data-testid="cal-config" role="dialog" aria-label="Edit Calendar Settings">
      <header className="bl-panel-head">
        <h2>Era</h2>
        <button type="button" aria-label="Close settings" onClick={onClose}>✕</button>
      </header>
      <label className="field">
        <span className="field-label">Era (sufixo do ano)</span>
        <input
          aria-label="Era"
          defaultValue={cal.era ?? ""}
          onBlur={(e) => store().setEra(cal.id, e.target.value.trim() || undefined)}
        />
      </label>
      <label className="field">
        <span className="field-label">Dia da semana do 1º dia</span>
        <select
          aria-label="First day"
          defaultValue={String(cal.startingWeekday)}
          onChange={(e) => store().setStartingWeekday(cal.id, Number(e.target.value))}
        >
          {cal.weekdays.map((w, i) => <option key={i} value={i}>{w}</option>)}
        </select>
      </label>
      <section>
        <h3 style={{ fontSize: 13, color: "var(--text-muted)" }}>Weekdays</h3>
        <ul className="cal-months-config cal-weekdays-config" data-testid="cal-weekdays-config">
          {cal.weekdays.map((w, i) => (
            <li key={i}>
              <span className="dim">{i + 1}º</span>
              <input
                aria-label={`Weekday ${i + 1}`}
                placeholder="Weekday name..."
                defaultValue={w}
                onBlur={(e) => {
                  const next = cal.weekdays.slice();
                  next[i] = e.target.value.trim();
                  store().setWeekdays(cal.id, next);
                }}
              />
              <label className="check-row" title="Marcar como fim de semana">
                <input
                  type="checkbox"
                  aria-label={`Weekend day ${i + 1}`}
                  checked={(cal.weekendDays ?? [0, 6]).includes(i)}
                  onChange={(e) => {
                    const cur = new Set(cal.weekendDays ?? [0, 6]);
                    if (e.target.checked) cur.add(i); else cur.delete(i);
                    store().setWeekendDays(cal.id, [...cur]);
                  }}
                />
                <span>Weekend</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 style={{ fontSize: 13, color: "var(--text-muted)" }}>Months</h3>
        <ul className="cal-months-config">
          {cal.months.map((m, i) => (
            <li key={i}>
              <input
                aria-label={`Month name ${i + 1}`}
                placeholder="Month name..."
                defaultValue={m.name}
                onBlur={(e) => store().setMonth(cal.id, i, { name: e.target.value })}
              />
              <input
                type="number"
                min={1}
                aria-label={`Days of ${i + 1}`}
                defaultValue={m.days}
                onBlur={(e) => store().setMonth(cal.id, i, { days: Number(e.target.value) })}
              />
              {cal.months.length > 1 ? (
                <button type="button" aria-label={`Remove month ${i + 1}`} className="cal-month-remove"
                  onClick={() => { store().removeMonth(cal.id, i); onClose(); }}>✕</button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="cal-month-add" data-testid="cal-month-add">
          <input aria-label="New month name" placeholder="New month..." defaultValue=""
            onBlur={(e) => { if (e.target.value.trim()) { store().addMonth(cal.id, e.target.value.trim(), 30); e.target.value = ""; } }} />
          <input aria-label="New month days" type="number" min={1} placeholder="Days" defaultValue={30}
            onBlur={(e) => { void Number(e.target.value); }} />
          <button
            type="button"
            onClick={() => {
              const name = (document.querySelector('[aria-label="New month name"]') as HTMLInputElement)?.value ?? "";
              const days = Number((document.querySelector('[aria-label="New month days"]') as HTMLInputElement)?.value ?? 30) || 30;
              if (name.trim()) { store().addMonth(cal.id, name.trim(), days); onClose(); }
            }}
          >+ Month</button>
        </div>
      </section>
    </div>
  );
}

function CalNotepad({ notes, onNotes, onClose }: { notes: string; onNotes(v: string): void; onClose(): void }) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => {
    const id = setTimeout(() => { if (draft !== notes) onNotes(draft); }, 300);
    return () => clearTimeout(id);
  }, [draft, notes, onNotes]);
  return (
    <div className="bl-notepad" data-testid="cal-notepad">
      <header className="bl-notepad-head">
        <span>Notas</span>
        <button type="button" aria-label="Close notes" onClick={onClose}>✕</button>
      </header>
      <textarea aria-label="Calendar notes" value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
    </div>
  );
}
