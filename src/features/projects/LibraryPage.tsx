import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import { Seal } from "../../ui/Seal";
import type { Project } from "../../domain/types";
import "./projects.css";

interface ForgeDef {
  name: string;
  desc: string;
  letter: string;
  path: (worldId: string) => string;
  double?: { label: string; path: (worldId: string) => string };
}

const FORGES: ForgeDef[] = [
  { name: "Codex", desc: "Build interconnected lore about your world.", letter: "T", path: (w) => `/p/${w}/entries` },
  { name: "Atlas", desc: "Pin and outline an interactive world map.", letter: "A", path: (w) => `/p/${w}/atlas` },
  { name: "Calendar", desc: "Craft calendars for your world.", letter: "C", path: (w) => `/p/${w}/calendar` },
  { name: "Plot board", desc: "Weave plot boards and story beats.", letter: "L", path: (w) => `/p/${w}/plotboard` },
  {
    name: "Bloodline", desc: "Bloodlines, lineages and sworn oaths.", letter: "B",
    path: (w) => `/p/${w}/bloodline`,
    double: { label: "Oaths", path: (w) => `/p/${w}/oaths` },
  },
  { name: "Manuscript", desc: "Write chapters and assemble the manuscript.", letter: "C2", path: (w) => `/p/${w}/manuscript` },
  { name: "Bindery Scriptorium", desc: "Lay out and export the finished book.", letter: "S", path: (w) => `/p/${w}/manuscript` },
];

function updatedStamp(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) { const m = Math.max(1, Math.floor(s / 60)); return `${m} minute${m === 1 ? "" : "s"} ago`; }
  if (s < 86400) { const h = Math.max(1, Math.floor(s / 3600)); return `${h} hour${h === 1 ? "" : "s"} ago`; }
  if (s < 7 * 86400) { const d = Math.max(1, Math.floor(s / 86400)); return `${d} day${d === 1 ? "" : "s"} ago`; }
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LibraryPage() {
  const projects = useScriptorium((s) => s.projects);
  const addProject = useScriptorium((s) => s.addProject);
  const deleteProject = useScriptorium((s) => s.deleteProject);
  const pushToast = useScriptorium((s) => s.pushToast);
  const seedDemo = useScriptorium((s) => s.seedDemo);
  const images = useScriptorium((s) => s.images);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [chosenWorld, setChosenWorld] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"recent" | "name">("recent");

  const activeWorld: Project | null = useMemo(() => {
    if (projects.length === 0) return null;
    if (projects.length === 1) return projects[0];
    if (chosenWorld) {
      const found = projects.find((p) => p.id === chosenWorld);
      if (found) return found;
    }
    return projects.reduce((latest, p) => (p.updatedAt >= latest.updatedAt ? p : latest), projects[projects.length - 1]);
  }, [projects, chosenWorld]);

  const showSelector = projects.length >= 2;

  const submitCreate = () => {
    const n = name.trim();
    if (!n) { pushToast("error", "Give the world a name."); return; }
    addProject(n, description.trim());
    setCreating(false);
    setName("");
    setDescription("");
    pushToast("success", "World created.");
  };

  const doSeed = () => {
    seedDemo();
    pushToast("success", "Sample project loaded.");
  };

  const target = projects.find((p) => p.id === toDelete);

  const worldList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects.filter((p) =>
      !q || p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
    if (sortKey === "name") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [projects, query, sortKey]);

  return (
    <div className="hub">
      <header className="hub-head">
        <div className="hub-brand">
          <Seal letter="S" />
          <span className="hub-wordmark">Scriptorium</span>
        </div>
        <div className="hub-welcome-row">
          <h1 className="hub-welcome">Welcome back</h1>
          {showSelector && (
            <select
              className="hub-world-select"
              aria-label="Active world"
              value={activeWorld?.id ?? ""}
              onChange={(e) => setChosenWorld(e.target.value)}
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
        <nav className="hub-pillars" aria-label="Site pages">
          <Link to="/chronicles" className="hub-link">Chronicles</Link>
          <Link to="/updates" className="hub-link">Updates</Link>
          <Link to="/settings" className="hub-link">Settings</Link>
          <Link to="/profile" className="hub-link">Profile</Link>
        </nav>
      </header>

      <hr className="hub-rule" />

      <section aria-label="Forges">
        <div className="forge-grid">
          {FORGES.map((f) => {
            const live = activeWorld !== null;
            const inner = (
              <>
                <span className="forge-side"><Seal letter={f.letter.slice(0, 1)} /></span>
                <span className="forge-name">{f.name}</span>
                <span className="forge-desc">{f.desc}</span>
                {live && f.double && (
                  <span className="forge-sublinks">
                    <Link className="forge-sublink" to={f.path(activeWorld.id)}>Bloodline</Link>
                    <span aria-hidden>·</span>
                    <Link className="forge-sublink" to={f.double.path(activeWorld.id)}>{f.double.label}</Link>
                  </span>
                )}
              </>
            );
            if (!live) {
              return (
                <div className="forge-card forge-ghost" aria-disabled="true" key={f.name}>
                  {inner}
                </div>
              );
            }
            if (f.double) {
              return <div className="forge-card" key={f.name}>{inner}</div>;
            }
            const wide = f.name === "Bindery Scriptorium";
            return (
              <Link
                key={f.name}
                to={activeWorld ? f.path(activeWorld.id) : "#"}
                className={"forge-card forge-link" + (wide ? " forge-wide" : "")}
                aria-label={f.name}
              >
                {inner}
              </Link>
            );
          })}
        </div>
        {projects.length === 0 && (
          <p className="forge-note">Create a world to enable the forges.</p>
        )}
      </section>

      <hr className="hub-rule" />

      <section aria-label="My worlds">
        <div className="hub-worlds-head">
          <h2 className="hub-section-title">My worlds</h2>
          {projects.length >= 3 && (
            <div className="worlds-tools">
              <input
                type="search"
                className="worlds-search"
                placeholder="Search worlds…"
                aria-label="Search worlds"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select className="worlds-sort" aria-label="Sort worlds" value={sortKey} onChange={(e) => setSortKey(e.target.value as "recent" | "name")}>
                <option value="recent">Recently updated</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          )}
          <Button className="worlds-new" onClick={() => setCreating(true)}>New world</Button>
        </div>

        {projects.length === 0 ? (
          <div className="empty">
            <p>Create your first world or load the sample project.</p>
            <Button kind="ghost" onClick={doSeed}>Load the sample project</Button>
          </div>
        ) : worldList.length === 0 ? (
          <p className="worlds-none">No worlds match “{query.trim()}”.</p>
        ) : (
          <div className="library-grid">
            {worldList.map((p) => (
              <article key={p.id} className="project-card">
                <Link to={`/p/${p.id}`} className="project-link">
                  {p.coverImageKey && images[p.coverImageKey] && (
                    <img className="project-cover" src={images[p.coverImageKey]} alt="" />
                  )}
                  <h3 className="project-name">{p.name}</h3>
                  {p.description && <p className="project-desc">{p.description}</p>}
                  <p className="project-updated">Updated {updatedStamp(p.updatedAt)}</p>
                </Link>
                <button aria-label="Delete world" className="project-delete" onClick={() => setToDelete(p.id)}>
                  ✕
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {creating && (
        <Modal title="New world" onClose={() => setCreating(false)}>
          <div className="form-stack">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Description"><textarea aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></Field>
            <div className="form-actions">
              <Button onClick={submitCreate}>Create</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {target && (
        <Modal title={`Delete "${target.name}"?`} onClose={() => setToDelete(null)}>
          <p className="modal-warning">
            This removes the world, its entries, atlas and manuscripts. No going back.
          </p>
          <div className="form-actions">
            <Button kind="danger" onClick={() => { deleteProject(target.id); setToDelete(null); pushToast("success", "World deleted."); }}>
              Delete
            </Button>
            <Button kind="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
