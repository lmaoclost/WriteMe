import { Link } from "react-router-dom";

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
    <div className="mx-auto max-w-[960px] pt-7 px-6 pb-[72px]">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 max-[660px]:grid-cols-1">
        <h1 className="font-display text-[0.9rem] font-bold tracking-[0.14em] uppercase">
          <Link to="/" className="text-parchment no-underline hover:text-gold">Scriptorium</Link>
        </h1>
        <div className="text-center grid gap-0.5 max-[660px]:text-left">
          <h2 className="font-display text-[1.375rem] font-semibold text-parchment-strong">Updates</h2>
          <p className="m-0 text-slate text-sm">News, changes, and what we&apos;re forging next</p>
        </div>
        <div className="justify-self-end max-[660px]:justify-self-start">
          <Link to="/" className="inline-block text-lilac no-underline border border-line rounded-sm px-3.5 py-1.5 text-sm hover:text-parchment-strong hover:border-gold-dim">Feed</Link>
        </div>
      </header>
      <main className="mt-[34px]">
        <section className="max-w-[880px] mx-auto grid" aria-label="Release ledger">
          {SAMPLE_UPDATES.map((u) => (
            <article
              key={u.id}
              className="border-t border-line pt-4 pb-[15px] grid grid-cols-[1fr_auto] gap-x-6 content-center min-h-24 first:border-t-0 first:pt-0 max-[660px]:grid-cols-1 max-[660px]:min-h-0 [grid-template-areas:'title_meta-head'_'title_meta-tail'_'title_readmore'] max-[660px]:min-h-0 max-[660px]:[grid-template-areas:'meta-head'_'meta-tail'_'title'_'readmore']"
            >
              <p className="[grid-area:meta-head] m-0 mb-2 grid gap-[3px] content-end justify-items-end max-[660px]:justify-items-start">
                <span className="text-gold text-[0.75rem] tracking-[0.08em] [font-variant-numeric:tabular-nums] whitespace-nowrap" aria-label={`release date: ${releaseDate(u.date)}`}>
                  {releaseDate(u.date)}
                </span>
                <span className="text-slate text-xs tracking-[0.06em] uppercase">by Scriptorium</span>
              </p>
              <h3 className="[grid-area:title] self-center font-display text-[1.375rem] font-semibold text-parchment-strong m-0 pr-3 max-[660px]:pr-0">{u.title}</h3>
              <span className="[grid-area:readmore] justify-self-end self-end text-lilac text-[0.8125rem] font-medium max-[660px]:justify-self-start max-[660px]:mt-1">Read more →</span>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
