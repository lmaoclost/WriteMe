import { Link, useOutletContext } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { selectCounts, selectProject, useScriptorium } from "../../data/store";
import type { ProjectCounts } from "../../data/store";
import { fileToDataUrl } from "../../data/image";
import { Seal } from "../../ui/Seal";
import type { WorkspaceContext } from "./WorkspaceLayout";
import "./overview.css";

interface LedgerDef {
  letter: string;
  name: string;
  path: string;
  counter: string;
  read: (c: ProjectCounts) => string;
}

const LEDGER: LedgerDef[] = [
  { letter: "T", name: "Codex", path: "entries", counter: "Codex entries", read: (c) => c.entries > 0 ? String(c.entries) : "\u2014" },
  { letter: "A", name: "Atlas", path: "atlas", counter: "Atlas pins", read: (c) => c.atlasPins > 0 ? `${c.atlasRegions} regions · ${c.atlasPins} pins` : "—" },
  { letter: "B", name: "Bloodline", path: "bloodline", counter: "Bloodline persons", read: (c) => c.bloodlinePersons > 0 ? String(c.bloodlinePersons) : "\u2014" },
  { letter: "O", name: "Oaths", path: "oaths", counter: "Oaths members", read: (c) => c.oathMembers > 0 ? String(c.oathMembers) : "\u2014" },
  { letter: "F", name: "Factions", path: "factions", counter: "Factions", read: (c) => c.factions > 0 ? String(c.factions) : "\u2014" },
  { letter: "C", name: "Calendar", path: "calendar", counter: "Calendar events", read: (c) => c.calendarEvents > 0 ? String(c.calendarEvents) : "\u2014" },
  { letter: "L", name: "Plot board", path: "plotboard", counter: "Plot board cards", read: (c) => c.plotCards > 0 ? String(c.plotCards) : "\u2014" },
  { letter: "W", name: "Timeline wheel", path: "linewheel", counter: "Timeline beads", read: (c) => c.timelineBeads > 0 ? String(c.timelineBeads) : "\u2014" },
  { letter: "K", name: "Wellspring", path: "wellspring", counter: "Wellspring nodes", read: (c) => c.wellspringNodes > 0 ? String(c.wellspringNodes) : "\u2014" },
  { letter: "K2", name: "Conlang", path: "conlang", counter: "Conlang words", read: (c) => c.conlangWords > 0 ? String(c.conlangWords) : "\u2014" },
  { letter: "M", name: "Manuscript", path: "manuscript", counter: "Manuscript chapters", read: (c) => c.chapters > 0 ? String(c.chapters) : "\u2014" },
];

export function OverviewPage() {
  const { projectId } = useOutletContext<WorkspaceContext>();
  const project = useScriptorium(selectProject(projectId));
  const counts = useScriptorium(useShallow(selectCounts(projectId)));
  const putImage = useScriptorium((s) => s.putImage);
  const updateProject = useScriptorium((s) => s.updateProject);
  const removeImage = useScriptorium((s) => s.removeImage);
  const images = useScriptorium((s) => s.images);
  const pushToast = useScriptorium((s) => s.pushToast);

  const onCover = async (file: File) => {
    if (!project) return;
    try {
      const { dataUrl } = await fileToDataUrl(file);
      const key = putImage(dataUrl, "cover");
      const oldKey = project.coverImageKey;
      updateProject(projectId, { coverImageKey: key });
      if (oldKey && oldKey !== key) removeImage(oldKey);
      pushToast("success", "Cover updated.");
    } catch {
      pushToast("error", "That image could not be loaded.");
    }
  };

  return (
    <div className="overview">
      <header className="ov-hero">
        <label className="ov-cover">
          {project?.coverImageKey && images[project.coverImageKey] && (
            <img src={images[project.coverImageKey]} alt="" className="ov-cover-img" />
          )}
          <span className="ov-cover-hint">Change cover</span>
          <input
            type="file"
            accept="image/*"
            aria-label="Change cover"
            className="visually-hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onCover(f);
              e.target.value = "";
            }}
          />
        </label>
        <div className="ov-hero-text">
          <h1 className="ov-name">{project?.name}</h1>
          {project?.description && <p className="ov-desc">{project.description}</p>}
        </div>
      </header>

      <section className="ov-ledger" aria-label="Forge ledger">
        <ul className="ledger">
          {LEDGER.map((f) => (
            <li className="ledger-row" key={f.name}>
              <Link className="ledger-link" to={`/p/${projectId}/${f.path}`}>
                <span className="letter-col"><Seal letter={f.letter.slice(0, 1)} /></span>
                <span className="ledger-name">{f.name}</span>
              </Link>
              <span className="ledger-count" aria-label={f.counter}>{f.read(counts)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}