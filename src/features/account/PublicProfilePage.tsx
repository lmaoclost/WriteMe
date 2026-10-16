import { Link, useParams } from "react-router-dom";
import { useAccount } from "../../data/account";
import { useScriptorium } from "../../data/store";
import { Seal } from "../../ui/Seal";
import "./profile.css";

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
      <div className="pub-profile">
        <div className="pub-back"><Link to="/" className="ghost-link">← Back to Feed</Link></div>
        <p className="pub-notfound">No profile named “{decodeURIComponent(username ?? "")}”.</p>
      </div>
    );
  }

  const activeRoles = ROLES.filter((r) => (user[r.key] ?? "").trim().length > 0);
  const initial = (user.username || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="pub-profile">
      <div className="pub-back">
        <Seal letter="S" />
        <span className="pub-wordmark">Scriptorium</span>
        <Link to="/" className="ghost-link pub-back-link">← Back to Feed</Link>
      </div>

      <header className="pub-hero">
        <div className="pub-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span className="pub-avatar-initial">{initial}</span>}
        </div>
        <div className="pub-ident">
          <h1 className="pub-name">{user.username}</h1>
          {activeRoles.length > 0 && (
            <p className="pub-roles">
              {activeRoles.map((r, i) => (
                <span key={r.key} className="pub-role">{r.tag}{i < activeRoles.length - 1 && <span aria-hidden> · </span>}</span>
              ))}
            </p>
          )}
        </div>
      </header>

      {activeRoles.map((r) => (
        <section className="pub-bio-section" key={r.key}>
          <h2 className="pub-bio-title">{r.title}</h2>
          <p className="pub-bio-text">{(user[r.key] ?? "").trim()}</p>
        </section>
      ))}

      <section className="pub-worlds" aria-label="Worlds by this profile">
        <h2 className="pub-section-title">My worlds</h2>
        {projects.length === 0 ? (
          <p className="pub-noworlds">No public worlds yet.</p>
        ) : (
          <div className="pub-world-grid">
            {projects.map((p) => (
              <article key={p.id} className="project-card">
                <Link to={`/p/${p.id}`} className="project-link">
                  {p.coverImageKey && images[p.coverImageKey] && (
                    <img className="project-cover" src={images[p.coverImageKey]} alt="" />
                  )}
                  <h3 className="project-name">{p.name}</h3>
                  {p.description && <p className="project-desc">{p.description}</p>}
                  <p className="project-updated">Updated {updatedStamp(p.updatedAt)}</p>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
