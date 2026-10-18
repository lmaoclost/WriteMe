import { Navigate, NavLink, Outlet, useParams, Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { selectProject, useScriptorium } from "../../data/store";
import { Seal } from "../../ui/Seal";

const SECTIONS = [
  { key: "overview", label: "Overview", to: "" },
  { key: "atlas", label: "Atlas", to: "atlas" },
  { key: "entries", label: "Lore", to: "entries" },
  { key: "timeline", label: "Chronology", to: "timeline" },
  { key: "bloodline", label: "Bloodline", to: "bloodline" },
  { key: "factions", label: "Factions", to: "factions" },
  { key: "calendar", label: "Calendar", to: "calendar" },
  { key: "plotboard", label: "Plot board", to: "plotboard" },
  { key: "linewheel", label: "Timeline", to: "linewheel" },
  { key: "oaths", label: "Oaths", to: "oaths" },
  { key: "wellspring", label: "Ideas", to: "wellspring" },
  { key: "conlang", label: "Language", to: "conlang" },
  { key: "manuscript", label: "Manuscript", to: "manuscript" },
  { key: "bindery", label: "Publishing", to: "bindery" },
] as const;

const RAIL_LINK = "px-3 py-[9px] rounded-sm text-xs tracking-[0.1em] uppercase whitespace-nowrap text-ellipsis overflow-hidden no-underline transition-colors max-[720px]:flex-none max-[720px]:overflow-visible max-[720px]:whitespace-nowrap max-[720px]:text-ellipsis max-[720px]:text-clip";

export function WorkspaceLayout() {
  const { projectId } = useParams();
  const project = useScriptorium(selectProject(projectId ?? ""));
  const coverUrl = useScriptorium((s) => (project?.coverImageKey ? s.images[project.coverImageKey] : undefined));
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
        <Link
          to={`/p/${projectId}`}
          data-testid="rail-world"
          className="group mb-1 flex max-w-full items-center gap-2 rounded-sm px-3 py-1.5 no-underline text-parchment transition-colors hover:text-parchment-strong"
          title={project.name}
        >
          {coverUrl && <img src={coverUrl} alt="" className="size-6 flex-none rounded-sm object-cover" />}
          <span className="truncate font-display text-sm font-semibold tracking-[-0.01em]">{project.name}</span>
        </Link>
        <Link
          to="/"
          className={RAIL_LINK + " mb-1 border-b border-line pb-3.5 text-slate hover:text-parchment max-[720px]:border-b-0"}
        >
          ← My worlds
        </Link>
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
