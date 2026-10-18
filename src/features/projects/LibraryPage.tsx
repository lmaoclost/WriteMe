import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useScriptorium } from "../../data/store";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import { Seal } from "../../ui/Seal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  // only cover values for the listed projects — an unrelated image upload
  // no longer re-renders the whole library
  const covers = useScriptorium(useShallow((s) => {
    const out: Record<string, string> = {};
    for (const p of s.projects) {
      if (p.coverImageKey && s.images[p.coverImageKey]) out[p.coverImageKey] = s.images[p.coverImageKey];
    }
    return out;
  }));

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"recent" | "name">("recent");

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
    <div className="relative mx-auto max-w-[1080px] px-6 pt-9 pb-16">
      <header className="grid justify-items-start gap-2.5">
        <div className="flex items-center gap-2.5">
          <Seal letter="S" className="size-7 text-sm" />
          <span className="font-display text-[15px] uppercase tracking-[0.14em] text-parchment">Scriptorium</span>
        </div>
        <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,2.75rem)] tracking-[-0.02em] leading-[1.15] text-parchment-strong">Welcome back</h1>
      </header>

      <hr className="w-full border-0 border-t border-line my-9" />

      <section aria-label="My worlds">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="font-display text-[1.375rem] font-semibold text-parchment-strong">My worlds</h2>
          {projects.length >= 3 && (
            <div className="flex gap-2.5">
              <input
                type="search"
                className="w-[200px] rounded-sm border border-line bg-night px-2.5 py-[7px] text-sm text-parchment placeholder:text-slate outline-none focus-visible:border-gold-dim"
                placeholder="Search worlds…"
                aria-label="Search worlds"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as "recent" | "name")}>
                <SelectTrigger
                  aria-label="Sort worlds"
                  className="justify-between rounded-sm border-line bg-night px-2.5 py-1.5 text-sm text-parchment hover:border-gold-dim data-[size=default]:h-auto"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-line bg-night text-parchment">
                  <SelectItem value="recent" className="text-sm focus:bg-[#24233f] focus:text-parchment">Recently updated</SelectItem>
                  <SelectItem value="name" className="text-sm focus:bg-[#24233f] focus:text-parchment">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button className="flex-none" onClick={() => setCreating(true)}>New world</Button>
        </div>

        {projects.length === 0 ? (
          <div className="grid justify-items-center gap-3.5 rounded-lg border border-dashed border-line p-[42px] text-center text-parchment-dim">
            <p>Create your first world or load the sample project.</p>
            <Button kind="ghost" onClick={doSeed}>Load the sample project</Button>
          </div>
        ) : worldList.length === 0 ? (
          <p className="text-slate text-sm">No worlds match “{query.trim()}”.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {worldList.map((p) => (
              <article key={p.id} className="relative flex flex-col min-h-[120px] overflow-hidden rounded-lg border border-line bg-night transition-[border-color] duration-[180ms] hover:border-gold-dim">
                <Link to={`/p/${p.id}`} className="grid gap-1.5 p-4 text-inherit no-underline">
                  {p.coverImageKey && covers[p.coverImageKey] && (
                    <img className="h-[120px] w-full object-cover" src={covers[p.coverImageKey]} alt="" />
                  )}
                  <h3 className="font-display text-[1.25rem] font-semibold">{p.name}</h3>
                  {p.description && <p className="text-slate text-[0.8125rem] m-0">{p.description}</p>}
                  <p className="text-[var(--text-faint)] text-xs m-0">Updated {updatedStamp(p.updatedAt)}</p>
                </Link>
                <button
                  aria-label="Delete world"
                  className="absolute top-2 right-2 flex size-[26px] items-center justify-center rounded-sm border border-line bg-ink text-xs text-slate transition-colors hover:border-danger hover:text-danger"
                  onClick={() => setToDelete(p.id)}
                >
                  ✕
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {creating && (
        <Modal title="New world" onClose={() => setCreating(false)} closeLabel="Close">
          <div className="grid gap-3">
            <Field label="Name"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Description"><textarea aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></Field>
            <div className="mt-2 flex justify-end gap-2.5">
              <Button onClick={submitCreate}>Create</Button>
              <Button kind="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {target && (
        <Modal title={`Delete "${target.name}"?`} onClose={() => setToDelete(null)} closeLabel="Close">
          <p className="text-parchment-dim">
            This removes the world, its entries, atlas and manuscripts. No going back.
          </p>
          <div className="mt-2 flex justify-end gap-2.5">
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
