import { Navigate, NavLink, Outlet, useParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { selectProject, useScriptorium } from "../../data/store";
import { Seal } from "../../ui/Seal";

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

const RAIL_LINK = "px-3 py-[9px] rounded-sm text-xs tracking-[0.1em] uppercase whitespace-nowrap text-ellipsis overflow-hidden no-underline transition-colors max-[720px]:flex-none max-[720px]:overflow-visible max-[720px]:whitespace-nowrap max-[720px]:text-ellipsis max-[720px]:text-clip";

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
    <div className="grid grid-cols-[180px_1fr] h-screen max-[720px]:grid-cols-1 max-[720px]:grid-rows-[auto_1fr]">
      <nav
        aria-label="World sections"
        className="sticky top-0 h-screen bg-night border-r border-line px-3.5 pt-[22px] pb-4 flex flex-col gap-1.5 overflow-y-hidden max-[720px]:static max-[720px]:h-auto max-[720px]:flex-row max-[720px]:items-center max-[720px]:overflow-x-auto max-[720px]:pr-4 max-[720px]:[scrollbar-width:none] max-[720px]:[&::-webkit-scrollbar]:hidden"
      >
        <div className="mb-[18px] shrink-0">
          <Seal letter="S" />
        </div>
        {SECTIONS.map((s) => (
          <NavLink
            key={s.key}
            to={`/p/${projectId}/${s.to}`.replace(/\/$/, "")}
            end={s.key === "overview" || undefined}
            className={({ isActive }) =>
              RAIL_LINK +
              (isActive
                ? " text-gold bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] shadow-[inset_2px_0_0_var(--gold)]"
                : " text-slate hover:text-parchment")
            }
          >
            <span>{s.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="h-screen min-h-0 overflow-hidden py-6 px-7 max-[720px]:p-5">
        <Outlet context={{ projectId }} />
      </main>
    </div>
  );
}