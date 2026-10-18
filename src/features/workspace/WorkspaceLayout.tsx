import { Navigate, NavLink, Outlet, useParams, Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
  Book, BookOpen, Calendar, Feather, Hourglass, Languages, LayoutGrid,
  Lightbulb, Map, Network, Orbit, Shield, Users, type LucideIcon,
} from "lucide-react";
import { selectProject, useScriptorium } from "../../data/store";
import { Seal } from "../../ui/Seal";

interface SectionDef {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
  group: string;
  tip: string;
}

const SECTIONS: SectionDef[] = [
  { key: "overview", label: "Overview", to: "", icon: BookOpen, group: "", tip: "The world's home" },
  { key: "atlas", label: "Atlas", to: "atlas", icon: Map, group: "Reference", tip: "Map regions and drop pins for places" },
  { key: "entries", label: "Lore", to: "entries", icon: Book, group: "Reference", tip: "Characters, places, creatures and things" },
  { key: "timeline", label: "Chronology", to: "timeline", icon: Hourglass, group: "Reference", tip: "Dated events in world order" },
  { key: "bloodline", label: "Bloodline", to: "bloodline", icon: Users, group: "Relations", tip: "Family trees across generations" },
  { key: "factions", label: "Factions", to: "factions", icon: Network, group: "Relations", tip: "Who fights whom, who backs whom" },
  { key: "oaths", label: "Oaths", to: "oaths", icon: Shield, group: "Relations", tip: "Chains of loyalty between groups" },
  { key: "calendar", label: "Calendar", to: "calendar", icon: Calendar, group: "Worldbuilding", tip: "Your world's own year and months" },
  { key: "plotboard", label: "Plot board", to: "plotboard", icon: LayoutGrid, group: "Worldbuilding", tip: "Story arcs as cards on a board" },
  { key: "linewheel", label: "Timeline", to: "linewheel", icon: Orbit, group: "Worldbuilding", tip: "Beads strung on a wheel" },
  { key: "wellspring", label: "Ideas", to: "wellspring", icon: Lightbulb, group: "Writing", tip: "Loose ideas, before they have a home" },
  { key: "conlang", label: "Language", to: "conlang", icon: Languages, group: "Writing", tip: "Words and phonetics for your tongue" },
  { key: "manuscript", label: "Manuscript", to: "manuscript", icon: Feather, group: "Writing", tip: "Write the chapters" },
  { key: "bindery", label: "Publishing", to: "bindery", icon: BookOpen, group: "Writing", tip: "Trim the manuscript for export" },
];

const GROUPS = ["Reference", "Relations", "Worldbuilding", "Writing"] as const;

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
        {SECTIONS.filter((s) => !s.group).map((s) => (
          <NavLink
            key={s.key}
            to={`/p/${projectId}/${s.to}`.replace(/\/$/, "")}
            end={s.key === "overview" || undefined}
            title={s.tip}
            className={({ isActive }) =>
              RAIL_LINK +
              (isActive
                ? " text-gold bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] shadow-[inset_2px_0_0_var(--gold)]"
                : " text-slate hover:text-parchment")
            }
          >
            <s.icon aria-hidden className="size-3.5 flex-none opacity-80" />
            <span>{s.label}</span>
          </NavLink>
        ))}
        {GROUPS.map((g) => (
          <div key={g} className="max-[720px]:contents">
            <p className="mt-2 mb-0.5 px-3 text-[9px] uppercase tracking-[0.22em] text-[var(--text-faint)] max-[720px]:hidden" aria-hidden="true">{g}</p>
            {SECTIONS.filter((s) => s.group === g).map((s) => (
              <NavLink
                key={s.key}
                to={`/p/${projectId}/${s.to}`}
                title={s.tip}
                className={({ isActive }) =>
                  RAIL_LINK +
                  (isActive
                    ? " text-gold bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] shadow-[inset_2px_0_0_var(--gold)]"
                    : " text-slate hover:text-parchment")
                }
              >
                <s.icon aria-hidden className="size-3.5 flex-none opacity-80" />
                <span>{s.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <main className="h-screen min-h-0 overflow-hidden py-6 px-7 max-[720px]:p-5">
        <Outlet context={{ projectId }} />
      </main>
    </div>
  );
}
