import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useWriteme } from "../../data/store";
import { dateIsEmpty, dateKey, formatDateWithCalendar, sanitizeDate } from "../../domain/dates";
import type { CustomCalendar } from "../../domain/types";
import { CATEGORY_COLORS, categoryDot } from "../entries/categories";

interface DatedRow {
  id: string;
  title: string;
  category: string;
  date: string;
  body: string;
}
interface UndatedRow {
  id: string;
  title: string;
  corrupted: boolean;
}

/** First non-empty line of the body, capped at 120 chars. */
const snippet = (body: string): string => {
  const first = body.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "";
  return first.length > 120 ? `${first.slice(0, 120)}…` : first;
};

export function TimelinePage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const entries = useWriteme(
    useShallow((s) => s.entries.filter((e) => e.projectId === projectId)),
  );
  const calendar = useWriteme(
    (s) => (s.calendars ?? []).find((c) => c.projectId === projectId),
  );
  const navigate = useNavigate();
  const [onlyEvents, setOnlyEvents] = useState(false);

  const dated: DatedRow[] = [];
  const undated: UndatedRow[] = [];
  for (const entry of entries) {
    if (onlyEvents && entry.category !== "event") continue;
    const raw = entry.date ?? "";
    const clean = dateIsEmpty(raw) ? null : sanitizeDate(raw);
    if (clean === null) {
      undated.push({ id: entry.id, title: entry.title, corrupted: raw.length > 0 });
      continue;
    }
    dated.push({
      id: entry.id,
      title: entry.title,
      category: entry.category,
      date: clean,
      body: entry.body,
    });
  }
  dated.sort((a, b) => dateKey(a.date) - dateKey(b.date));

  const openEntry = (id: string) => {
    navigate(`/p/${projectId}/entries?e=${id}`);
  };
  const fmt = (date: string) => formatDateWithCalendar(date, calendar as CustomCalendar | undefined);
  // era is constant for the whole line — shown once above it, not per row
  // (a long era suffix would overflow the 160px date column)
  const cellFmt = (date: string) => formatDateWithCalendar(date, calendar ? { months: calendar.months } : undefined);

  return (
    <div className="h-full overflow-y-auto py-[22px] px-7 max-w-[920px] max-[720px]:p-[18px] max-[720px]:px-3.5">
      <div className="grid gap-1 mb-4">
        <h1 className="m-0 font-display text-[22px] font-semibold text-parchment-strong">{t("timeline.title")}</h1>
        <p className="m-0 text-slate text-sm">{t("timeline.purpose")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {calendar?.era ? <span className="timeline-era font-mono text-[11px] tracking-[0.06em] uppercase text-slate border border-line rounded-full py-[3px] px-2.5" data-testid="timeline-era">{calendar.era}</span> : null}
        <button
          type="button"
          aria-pressed={onlyEvents}
          onClick={() => setOnlyEvents(true)}
          className="bg-none border border-line text-parchment-dim rounded-full py-[3px] px-2.5 text-[11px] tracking-[0.06em] uppercase hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
        >
          {t("timeline.eventsOnly")}
        </button>
        <button
          type="button"
          aria-pressed={!onlyEvents}
          onClick={() => setOnlyEvents(false)}
          className="bg-none border border-line text-parchment-dim rounded-full py-[3px] px-2.5 text-[11px] tracking-[0.06em] uppercase hover:border-gold-dim aria-pressed:border-gold aria-pressed:text-gold"
        >
          {t("timeline.all")}
        </button>
      </div>
      {dated.length > 0 ? (
        <ol
          className="timeline list-none m-0 p-0 relative before:content-[''] before:absolute before:inset-y-0 before:left-[183px] before:w-0.5 before:bg-line max-[720px]:before:left-[115px]"
        >
          {dated.map((row) => {
            const label = `${row.title} — ${fmt(row.date)}`;
            return (
              <li
                className="timeline-item relative grid grid-cols-[160px_48px_1fr] items-center py-[7px] max-[720px]:grid-cols-[96px_40px_1fr]"
                key={row.id}
              >
                <span className="font-mono font-bold text-[13px] text-parchment-dim text-right pr-3.5 whitespace-nowrap" aria-hidden="true">{cellFmt(row.date)}</span>
                <span
                  className="timeline-dot size-2.5 rounded-full justify-self-center"
                  aria-hidden="true"
                  style={{ backgroundColor: categoryDot(row.category) }}
                />
                <button
                  type="button"
                  className="timeline-card flex flex-col gap-0.5 text-left bg-night border border-line rounded-lg text-parchment px-3 py-2 min-w-0 hover:border-gold-dim"
                  aria-label={label}
                  onClick={() => openEntry(row.id)}
                >
                  <span className="timeline-card-title font-display font-semibold text-[15px]">{row.title}</span>
                  <span className="timeline-card-body text-parchment-dim text-xs overflow-hidden text-ellipsis whitespace-nowrap">{snippet(row.body)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-parchment-dim text-sm my-[18px]">
          {t("timeline.empty")}
        </p>
      )}
      {undated.length > 0 ? (
        <section className="timeline-undated mt-[26px] border-t border-line pt-3.5" aria-label={t("timeline.undated")}>
          <h2 className="font-semibold text-[11px] tracking-[0.08em] uppercase text-slate">{t("timeline.undated")}</h2>
          <ul className="list-none mt-2 mb-0 p-0 flex flex-col">
            {undated.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full bg-none border-0 rounded-lg text-parchment px-2 py-1.5 text-[13px] text-left hover:bg-night-2"
                  onClick={() => openEntry(row.id)}
                >
                  <span
                    className="codex-dot timeline-undated-dot flex-none"
                    aria-hidden="true"
                    style={{ backgroundColor: row.corrupted ? CATEGORY_COLORS.event : "#7a7a99" }}
                  />
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{row.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
