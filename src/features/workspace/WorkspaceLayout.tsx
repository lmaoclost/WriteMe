import { Navigate, NavLink, Outlet, useParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { selectProject, useScriptorium } from "../../data/store";
import { Seal } from "../../ui/Seal";
import "./workspace.css";

const SECTIONS = [
  { key: "overview", label: "Overview", to: "" },
  { key: "atlas", label: "Atlas", to: "atlas" },
  { key: "entries", label: "Codex", to: "entries" },
  { key: "timeline", label: "Timeline", to: "timeline" },
  { key: "bloodline", label: "Bloodline", to: "bloodline" },
  { key: "factions", label: "Factions", to: "factions" },
  { key: "calendar", label: "Calendar", to: "calendar" },
  { key: "plotboard", label: "Plot board", to: "plotboard" },
  { key: "linewheel", label: "Timeline canvas", to: "linewheel" },
  { key: "oaths", label: "Oaths", to: "oaths" },
  { key: "wellspring", label: "Wellspring", to: "wellspring" },
  { key: "conlang", label: "Conlang", to: "conlang" },
  { key: "manuscript", label: "Manuscript", to: "manuscript" },
  { key: "bindery", label: "Bindery", to: "bindery" },
] as const;

export function WorkspaceLayout() {
  const { projectId } = useParams();
  const project = useScriptorium(selectProject(projectId ?? ""));
  const pushToast = useScriptorium((s) => s.pushToast);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!project && !warnedRef.current) {
      warnedRef.current = true;
      pushToast("error", "This world doesn't exist or was removed.");
    }
  }, [project, pushToast]);

  if (!project || !projectId) return <Navigate to="/" replace />;

  return (
    <div className="workspace">
      <nav className="rail" aria-label="World sections">
        <div className="rail-seal">
          <Seal letter="S" />
        </div>
        {SECTIONS.map((s) => (
          <NavLink
            key={s.key}
            to={`/p/${projectId}/${s.to}`.replace(/\/$/, "")}
            end={s.key === "overview" || undefined}
            className={({ isActive }) => `rail-link${isActive ? " active" : ""}`}
          >
            <span className="rail-label">{s.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="workspace-main">
        <Outlet context={{ projectId }} />
      </main>
    </div>
  );
}
