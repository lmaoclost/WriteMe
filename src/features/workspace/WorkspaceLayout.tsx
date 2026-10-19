import { Navigate, NavLink, Outlet, useParams, Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GROUPS, SECTIONS } from "../../app/sections";
import { selectProject, useScriptorium } from "../../data/store";
import { Seal } from "../../ui/Seal";
import { LanguageToggle } from "../../ui/LanguageToggle";

const RAIL_LINK = "flex items-center gap-2 px-3 py-[9px] rounded-sm text-xs tracking-[0.1em] uppercase whitespace-nowrap text-ellipsis overflow-hidden no-underline transition-colors max-[720px]:flex-none max-[720px]:overflow-visible max-[720px]:whitespace-nowrap max-[720px]:text-ellipsis max-[720px]:text-clip max-[720px]:min-w-0";

export function WorkspaceLayout() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const project = useScriptorium(selectProject(projectId ?? ""));
  const coverUrl = useScriptorium((s) => (project?.coverImageKey ? s.images[project.coverImageKey] : undefined));
  const pushToast = useScriptorium((s) => s.pushToast);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!project && !warnedRef.current) {
      warnedRef.current = true;
      pushToast("error", t("workspace.worldMissing"));
    }
  }, [project, pushToast, t]);

  if (!project || !projectId) return <Navigate to="/" replace />;

  return (
    <div className="grid grid-cols-[180px_1fr] h-screen max-[720px]:grid-cols-1 max-[720px]:grid-rows-[auto_1fr]">
      <nav
        aria-label={t("workspace.worldSections")}
        className="sticky top-0 h-screen bg-night border-r border-line px-3.5 pt-[22px] pb-4 flex flex-col gap-1.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[720px]:static max-[720px]:h-auto max-[720px]:flex-row max-[720px]:items-center max-[720px]:overflow-x-auto max-[720px]:pr-4 max-[720px]:[scrollbar-width:none] max-[720px]:[&::-webkit-scrollbar]:hidden"
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
          {t("workspace.myWorlds")}
        </Link>
        {SECTIONS.filter((s) => !s.groupKey).map((s) => (
          <NavLink
            key={s.key}
            to={`/p/${projectId}/${s.to}`.replace(/\/$/, "")}
            end={s.key === "overview" || undefined}
            title={t(s.tipKey)}
            className={({ isActive }) =>
              RAIL_LINK +
              (isActive
                ? " text-gold bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] shadow-[inset_2px_0_0_var(--gold)]"
                : " text-slate hover:text-parchment")
            }
          >
            <s.icon aria-hidden className="size-3.5 flex-none opacity-80" />
            <span>{t(s.labelKey)}</span>
          </NavLink>
        ))}
        {GROUPS.map((g) => (
          <div key={g.key} className="max-[720px]:contents">
            <p className="mt-2 mb-0.5 px-3 text-[9px] uppercase tracking-[0.22em] text-[var(--text-faint)] max-[720px]:hidden" aria-hidden="true">{t(g.labelKey)}</p>
            {SECTIONS.filter((s) => s.groupKey === g.key).map((s) => (
              <NavLink
                key={s.key}
                to={`/p/${projectId}/${s.to}`}
                title={t(s.tipKey)}
                className={({ isActive }) =>
                  RAIL_LINK +
                  (isActive
                    ? " text-gold bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] shadow-[inset_2px_0_0_var(--gold)]"
                    : " text-slate hover:text-parchment")
                }
              >
                <s.icon aria-hidden className="size-3.5 flex-none opacity-80" />
                <span>{t(s.labelKey)}</span>
              </NavLink>
            ))}
          </div>
        ))}
        <div className="mt-auto flex flex-col items-start gap-1 pt-2 max-[720px]:mt-0 max-[720px]:ml-auto max-[720px]:flex-row max-[720px]:items-center max-[720px]:pt-0">
          <LanguageToggle />
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 border-0 bg-none px-3 py-[9px] text-left text-xs uppercase tracking-[0.1em] text-slate hover:text-parchment max-[720px]:hidden"
            onClick={() => window.dispatchEvent(new Event("scriptorium:open-palette"))}
          >
            {t("workspace.search")} <span className="text-[9px] tracking-[0.06em] opacity-70">Ctrl+K</span>
          </button>
        </div>
      </nav>
      <main className="h-screen min-h-0 overflow-hidden py-6 px-7 max-[720px]:p-5">
        <Outlet context={{ projectId }} />
      </main>
    </div>
  );
}
