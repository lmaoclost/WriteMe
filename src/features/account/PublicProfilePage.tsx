import { Link, useParams } from "react-router-dom";
import { useAccount } from "../../data/account";
import { useScriptorium } from "../../data/store";
import { Seal } from "../../ui/Seal";

const ROLES: { key: "readerBio" | "worldbuilderBio" | "authorBio"; tag: string; title: string; blurb: string }[] = [
  { key: "readerBio", tag: "✦ Reader", title: "About you", blurb: "" },
  { key: "worldbuilderBio", tag: "✦ Worldbuilder", title: "Worldbuilder bio", blurb: "" },
  { key: "authorBio", tag: "✦ Author", title: "Author bio", blurb: "" },
];

function updatedStamp(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) { const m = Math.max(1, Math.floor(s / 60)); return `${m} minute${m === 1 ? "" : "s"} ago`; }
  if (s < 86400) { const h = Math.max(1, Math.floor(s / 3600)); return `${h} hour${h === 1 ? "" : "s"} ago`; }
  if (s < 7 * 86400) { const d = Math.max(1, Math.floor(s / 86400)); return `${d} day${d === 1 ? "" : "s"} ago`; }
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const user = useAccount();
  const projects = useScriptorium((s) => s.projects);
  const images = useScriptorium((s) => s.images);

  if (decodeURIComponent(username ?? "").toLowerCase() !== (user.username || "").toLowerCase()) {
    return (
      <div className="mx-auto max-w-[880px] pt-9 px-6 pb-[72px]">
        <div className="flex items-center gap-2.5"><Link to="/" className="text-lilac no-underline text-sm hover:text-parchment-strong">← Back to Feed</Link></div>
        <p className="text-slate mt-10 text-base">No profile named “{decodeURIComponent(username ?? "")}”.</p>
      </div>
    );
  }

  const activeRoles = ROLES.filter((r) => (user[r.key] ?? "").trim().length > 0);
  const initial = (user.username || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-[880px] pt-9 px-6 pb-[72px]">
      <div className="flex items-center gap-2.5">
        <Seal letter="S" className="size-[26px] text-[13px]" />
        <span className="font-display text-[13px] tracking-[0.14em] uppercase text-parchment">Scriptorium</span>
        <Link to="/" className="ml-auto text-lilac no-underline text-sm hover:text-parchment-strong">← Back to Feed</Link>
      </div>

      <header className="flex items-center gap-[22px] mt-[34px]">
        <div className="size-[88px] rounded-full overflow-hidden flex-none border border-line-strong bg-night-2 grid place-items-center">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="font-display text-[2rem] font-semibold text-gold">{initial}</span>}
        </div>
        <div className="grid gap-1.5">
          <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,2.75rem)] tracking-[-0.02em] leading-[1.1] text-parchment-strong">{user.username}</h1>
          {activeRoles.length > 0 && (
            <p className="m-0 text-slate text-sm flex flex-wrap">
              {activeRoles.map((r, i) => (
                <span key={r.key}>{r.tag}{i < activeRoles.length - 1 && <span aria-hidden> · </span>}</span>
              ))}
            </p>
          )}
        </div>
      </header>

      {activeRoles.map((r) => (
        <section className="border-t border-line mt-[30px] pt-[18px]" key={r.key}>
          <h2 className="font-display text-[0.9rem] font-semibold tracking-[0.08em] uppercase text-gold m-0 mb-2.5">{r.title}</h2>
          <p className="m-0 text-parchment leading-[1.65] max-w-[68ch]">{(user[r.key] ?? "").trim()}</p>
        </section>
      ))}

      <section className="border-t border-line mt-[30px] pt-[18px]" aria-label="Worlds by this profile">
        <h2 className="font-display text-[1.375rem] font-semibold text-parchment-strong m-0 mb-4">My worlds</h2>
        {projects.length === 0 ? (
          <p className="text-slate text-[0.9rem]">No public worlds yet.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {projects.map((p) => (
              <article key={p.id} className="relative flex flex-col min-h-[120px] overflow-hidden rounded-lg border border-line bg-night transition-[border-color] duration-[180ms] hover:border-gold-dim">
                <Link to={`/p/${p.id}`} className="grid gap-1.5 p-4 text-inherit no-underline">
                  {p.coverImageKey && images[p.coverImageKey] && (
                    <img className="h-[120px] w-full object-cover" src={images[p.coverImageKey]} alt="" />
                  )}
                  <h3 className="font-display text-[1.25rem] font-semibold">{p.name}</h3>
                  {p.description && <p className="text-slate text-[0.8125rem] m-0">{p.description}</p>}
                  <p className="text-[var(--text-faint)] text-xs m-0">Updated {updatedStamp(p.updatedAt)}</p>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
