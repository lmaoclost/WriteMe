import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import type { EntryCategory } from "../../domain/types";
import { dateIsEmpty, dateKey, formatDate, sanitizeDate } from "../../domain/dates";
import { CATEGORY_COLORS } from "../entries/categories";
import "./timeline.css";

interface DatedRow {
  id: string;
  title: string;
  category: EntryCategory;
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
  const entries = useScriptorium(
    useShallow((s) => s.entries.filter((e) => e.projectId === projectId)),
  );
  const navigate = useNavigate();
  const [onlyEvents, setOnlyEvents] = useState(true);

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
    navigate("../entries", { state: { select: id } });
  };

  return (
    <div className="timeline-page">
      <div className="timeline-chips">
        <button type="button" aria-pressed={onlyEvents} onClick={() => setOnlyEvents(true)}>
          Só eventos
        </button>
        <button type="button" aria-pressed={!onlyEvents} onClick={() => setOnlyEvents(false)}>
          Tudo
        </button>
      </div>
      {dated.length > 0 ? (
        <ol className="timeline">
          {dated.map((row) => {
            const label = `${row.title} — ${formatDate(row.date)}`;
            return (
              <li className="timeline-item" key={row.id}>
                <span className="date-col" aria-hidden="true">{formatDate(row.date)}</span>
                <button
                  type="button"
                  className="timeline-card"
                  aria-label={label}
                  onClick={() => openEntry(row.id)}
                >
                  <span className="timeline-card-title">{row.title}</span>
                  <span className="timeline-card-body">{snippet(row.body)}</span>
                </button>
                <span
                  className="timeline-dot"
                  aria-hidden="true"
                  style={{ backgroundColor: CATEGORY_COLORS[row.category] }}
                />
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="timeline-empty">
          Nenhum evento com data — edite uma entrada de evento e defina a data.
        </p>
      )}
      {undated.length > 0 ? (
        <section className="timeline-undated" aria-label="Sem data">
          <h2 className="timeline-undated-title">Sem data</h2>
          <ul className="timeline-undated-list">
            {undated.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="timeline-undated-row"
                  onClick={() => openEntry(row.id)}
                >
                  <span
                    className="codex-dot timeline-undated-dot"
                    aria-hidden="true"
                    style={{ backgroundColor: row.corrupted ? CATEGORY_COLORS.event : "#7a7a99" }}
                  />
                  <span className="timeline-undated-row-title">{row.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
