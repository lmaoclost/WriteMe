import { Link } from "react-router-dom";
import "./updates.css";

export interface SampleUpdate {
  id: string;
  title: string;
  date: Date;
}

const TITLES = [
  "Scriptorium Update — A NEW HOMEPAGE",
  "Scriptorium Update — OATHS HIERARCHY",
  "Scriptorium Update — ATLAS",
  "Scriptorium Update — PLOT BOARD MINOR",
  "Scriptorium Update — BINDERY UPDATE",
  "Scriptorium Update — CONNECTIONS UPDATE",
  "Scriptorium Update — MANUSCRIPT",
  "Scriptorium Update — CHRONICLES UP",
  "Scriptorium Update — CONLANG & LEXICON U",
  "Scriptorium Update — MANUSCRIPTS & TOMES",
];

const BASE = Date.parse("2026-10-15T12:00:00Z");
const DAY = 86400000;

export const SAMPLE_UPDATES: SampleUpdate[] = TITLES.map((title, i) => ({
  id: `update-${i}`,
  title,
  date: new Date(BASE - i * 3 * DAY),
}));

export function UpdatesPage() {
  return (
    <div className="updates-page">
      <header className="updates-header">
        <h1 className="brand">
          <Link to="/">Scriptorium</Link>
        </h1>
        <div className="header-center">
          <h2 className="page-title">Updates</h2>
          <p className="page-subtitle">News, changes, and what we're forging next</p>
        </div>
        <div className="header-right">
          <Link to="/" className="back-btn">Feed</Link>
        </div>
      </header>
      <main className="updates-content">
        <div className="updates-list">
          {SAMPLE_UPDATES.map((u) => (
            <article key={u.id} className="update-card">
              <p className="update-meta">
                <span className="update-date">
                  {u.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="update-author">by Scriptorium</span>
              </p>
              <h3 className="update-title">{u.title}</h3>
              <span className="update-readmore">Read more →</span>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}