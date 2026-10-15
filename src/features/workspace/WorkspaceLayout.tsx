import { Navigate, NavLink, Outlet, useParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { selectProject, useScriptorium } from "../../data/store";
import { Seal } from "../../ui/Seal";
import "./workspace.css";

const SECTIONS = [
  { key: "overview", label: "Visão Geral", to: "" },
  { key: "atlas", label: "Atlas", to: "atlas" },
  { key: "entries", label: "Códex", to: "entries" },
  { key: "timeline", label: "Cronologia", to: "timeline" },
  { key: "bloodline", label: "Linhagem", to: "bloodline" },
  { key: "factions", label: "Frações", to: "factions" },
  { key: "calendar", label: "Calendário", to: "calendar" },
  { key: "plotboard", label: "Planos", to: "plotboard" },
  { key: "manuscript", label: "Livro", to: "manuscript" },
] as const;

export function WorkspaceLayout() {
  const { projectId } = useParams();
  const project = useScriptorium(selectProject(projectId ?? ""));
  const pushToast = useScriptorium((s) => s.pushToast);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!project && !warnedRef.current) {
      warnedRef.current = true;
      pushToast("error", "Este mundo não existe ou foi removido.");
    }
  }, [project, pushToast]);

  if (!project || !projectId) return <Navigate to="/" replace />;

  return (
    <div className="workspace">
      <nav className="rail" aria-label="Seções do mundo">
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
