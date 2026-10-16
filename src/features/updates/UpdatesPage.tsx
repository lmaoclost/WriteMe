import { Link } from "react-router-dom";
import "./updates.css";

export interface SampleUpdate {
  id: string;
  title: string;
  date: Date;
}

interface Release {
  id: string;
  title: string;
  date: Date;
}

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

const RELEASES: Release[] = [
  { id: "rel-public-profiles", title: "Public profiles", date: day("2026-10-16") },
  { id: "rel-settings-backups", title: "Settings backups", date: day("2026-10-16") },
  { id: "rel-world-dashboard", title: "Overview: world dashboard", date: day("2026-10-16") },
  { id: "rel-the-hub", title: "The hub", date: day("2026-10-16") },
  { id: "rel-full-demo-world", title: "Full demo world", date: day("2026-10-15") },
  { id: "rel-visual-pass", title: "Visual pass", date: day("2026-10-14") },
];

export const SAMPLE_UPDATES: SampleUpdate[] = RELEASES.map(({ id, title, date }) => ({ id, title, date }));

function releaseDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
}

export function UpdatesPage() {
  return (
    <div className="updates-page">
      <header className="updates-header">
        <h1 className="brand">
          <Link to="/">Scriptorium</Link>
        </h1>
        <div className="header-center">
          <h2 className="page-title">Updates</h2>
          <p className="page-subtitle">News, changes, and what we&apos;re forging next</p>
        </div>
        <div className="header-right">
          <Link to="/" className="back-btn">Feed</Link>
        </div>
      </header>
      <main className="updates-content">
        <section className="updates-ledger" aria-label="Release ledger">
          {SAMPLE_UPDATES.map((u) => (
            <article key={u.id} className="update-row">
              <p className="update-meta">
                <span className="update-date" aria-label={`release date: ${releaseDate(u.date)}`}>
                  {releaseDate(u.date)}
                </span>
                <span className="update-author">by Scriptorium</span>
              </p>
              <h3 className="update-title">{u.title}</h3>
              <span className="update-readmore">Read more →</span>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}