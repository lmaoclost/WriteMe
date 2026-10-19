import { Link, useOutletContext } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { selectCounts, selectProject, useScriptorium } from "../../data/store";
import type { ProjectCounts } from "../../data/store";
import { fileToDataUrl } from "../../data/image";
import { Seal } from "../../ui/Seal";

export interface WorkspaceContext {
  projectId: string;
}

interface LedgerDef {
  letter: string;
  nameKey: string;
  path: string;
  counterKey: string;
  descKey: string;
  emptyKey?: string;
  read: (counts: ProjectCounts, t: TFunction) => string;
}

const LEDGER = [
  { letter: "T", nameKey: "overview.items.lore.name", path: "entries", counterKey: "overview.items.lore.counter", descKey: "overview.items.lore.desc", emptyKey: "overview.items.lore.empty", read: (c: ProjectCounts) => c.entries > 0 ? String(c.entries) : "" },
  { letter: "A", nameKey: "overview.items.atlas.name", path: "atlas", counterKey: "overview.items.atlas.counter", descKey: "overview.items.atlas.desc", emptyKey: "overview.items.atlas.empty", read: (c: ProjectCounts, t: TFunction) => c.atlasPins > 0 ? t("overview.items.atlas.count", { regions: c.atlasRegions, pins: c.atlasPins }) : "" },
  { letter: "D", nameKey: "overview.items.chronology.name", path: "timeline", counterKey: "overview.items.chronology.counter", descKey: "overview.items.chronology.desc", emptyKey: "overview.items.chronology.empty", read: (c: ProjectCounts) => c.chronologyEvents > 0 ? String(c.chronologyEvents) : "" },
  { letter: "B", nameKey: "overview.items.bloodline.name", path: "bloodline", counterKey: "overview.items.bloodline.counter", descKey: "overview.items.bloodline.desc", emptyKey: "overview.items.bloodline.empty", read: (c: ProjectCounts) => c.bloodlinePersons > 0 ? String(c.bloodlinePersons) : "" },
  { letter: "O", nameKey: "overview.items.oaths.name", path: "oaths", counterKey: "overview.items.oaths.counter", descKey: "overview.items.oaths.desc", emptyKey: "overview.items.oaths.empty", read: (c: ProjectCounts) => c.oathMembers > 0 ? String(c.oathMembers) : "" },
  { letter: "F", nameKey: "overview.items.factions.name", path: "factions", counterKey: "overview.items.factions.counter", descKey: "overview.items.factions.desc", emptyKey: "overview.items.factions.empty", read: (c: ProjectCounts) => c.factions > 0 ? String(c.factions) : "" },
  { letter: "C", nameKey: "overview.items.calendar.name", path: "calendar", counterKey: "overview.items.calendar.counter", descKey: "overview.items.calendar.desc", emptyKey: "overview.items.calendar.empty", read: (c: ProjectCounts) => c.calendarEvents > 0 ? String(c.calendarEvents) : "" },
  { letter: "L", nameKey: "overview.items.plotboard.name", path: "plotboard", counterKey: "overview.items.plotboard.counter", descKey: "overview.items.plotboard.desc", emptyKey: "overview.items.plotboard.empty", read: (c: ProjectCounts) => c.plotCards > 0 ? String(c.plotCards) : "" },
  { letter: "W", nameKey: "overview.items.timeline.name", path: "linewheel", counterKey: "overview.items.timeline.counter", descKey: "overview.items.timeline.desc", emptyKey: "overview.items.timeline.empty", read: (c: ProjectCounts) => c.timelineBeads > 0 ? String(c.timelineBeads) : "" },
  { letter: "K", nameKey: "overview.items.wellspring.name", path: "wellspring", counterKey: "overview.items.wellspring.counter", descKey: "overview.items.wellspring.desc", emptyKey: "overview.items.wellspring.empty", read: (c: ProjectCounts) => c.wellspringNodes > 0 ? String(c.wellspringNodes) : "" },
  { letter: "X", nameKey: "overview.items.conlang.name", path: "conlang", counterKey: "overview.items.conlang.counter", descKey: "overview.items.conlang.desc", emptyKey: "overview.items.conlang.empty", read: (c: ProjectCounts) => c.conlangWords > 0 ? String(c.conlangWords) : "" },
  { letter: "M", nameKey: "overview.items.manuscript.name", path: "manuscript", counterKey: "overview.items.manuscript.counter", descKey: "overview.items.manuscript.desc", emptyKey: "overview.items.manuscript.empty", read: (c: ProjectCounts) => c.chapters > 0 ? String(c.chapters) : "" },
  { letter: "S", nameKey: "overview.items.bindery.name", path: "bindery", counterKey: "overview.items.bindery.counter", descKey: "overview.items.bindery.desc", emptyKey: undefined, read: () => "✦" },
] as const satisfies readonly LedgerDef[];

export function OverviewPage() {
  const { t } = useTranslation();
  const { projectId } = useOutletContext<WorkspaceContext>();
  const project = useScriptorium(selectProject(projectId));
  const counts = useScriptorium(useShallow(selectCounts(projectId)));
  const putImage = useScriptorium((s) => s.putImage);
  const updateProject = useScriptorium((s) => s.updateProject);
  const removeImage = useScriptorium((s) => s.removeImage);
  const coverUrl = useScriptorium((s) => (project?.coverImageKey ? s.images[project.coverImageKey] : undefined));
  const pushToast = useScriptorium((s) => s.pushToast);

  const onCover = async (file: File) => {
    if (!project) return;
    try {
      const { dataUrl } = await fileToDataUrl(file);
      const key = putImage(dataUrl, "cover");
      const oldKey = project.coverImageKey;
      updateProject(projectId, { coverImageKey: key });
      if (oldKey && oldKey !== key) removeImage(oldKey);
      pushToast("success", t("overview.coverUpdated"));
    } catch {
      pushToast("error", t("overview.coverError"));
    }
  };

  return (
    <div className="mx-auto h-full max-w-[960px] overflow-y-auto pt-7 px-6 pb-16">
      <header className="grid gap-[18px]">
        <label className="group relative block h-[200px] rounded-lg border border-line overflow-hidden bg-[radial-gradient(ellipse_120%_80%_at_30%_20%,color-mix(in_srgb,var(--accent)_14%,var(--night-2)),var(--night))] cursor-pointer hover:border-gold-dim">
          {project?.coverImageKey && coverUrl && (
            <img src={coverUrl} alt="" className="block h-full w-full object-cover" />
          )}
          <span className="absolute right-3 bottom-3 bg-[color-mix(in_srgb,var(--ink)_88%,var(--gold)_4%)] text-parchment border border-gold-dim rounded-sm px-2.5 py-1.5 text-xs tracking-[0.04em] shadow-[0_18px_40px_rgb(16_16_30/0.55)] group-hover:border-gold group-hover:text-parchment-strong">{t("overview.changeCover")}</span>
          <input
            type="file"
            accept="image/*"
            aria-label={t("overview.changeCover")}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onCover(f);
              e.target.value = "";
            }}
          />
        </label>
        <div className="grid gap-1.5">
          <h1 className="font-display font-semibold text-[clamp(2rem,4.5vw,2.75rem)] tracking-[-0.02em] leading-[1.15] text-parchment-strong max-w-[24ch] [text-wrap:balance]">{project?.name}</h1>
          {project?.description && <p className="text-slate m-0 max-w-[70ch]">{project.description}</p>}
        </div>
      </header>

      <section className="mt-[30px]" aria-label={t("overview.forgeLedger")}>
        <ul className="list-none m-0 p-0 grid grid-cols-2 gap-x-14 max-[760px]:grid-cols-1">
          {LEDGER.map((f) => (
            <li
              key={f.nameKey}
              className="flex items-center justify-between gap-4 py-[13px] border-t border-line odd:pr-6 even:pl-6 [&:nth-child(-n+2)]:border-t-0 max-[760px]:odd:pr-0 max-[760px]:even:pl-0 max-[760px]:[&:nth-child(-n+2)]:border-t max-[760px]:[&:nth-child(-n+2)]:border-line max-[760px]:first:border-t-0"
            >
              <Link className="group flex items-center gap-3.5 text-inherit no-underline min-w-0" to={`/p/${projectId}/${f.path}`}>
                <span><Seal letter={f.letter.slice(0, 1)} className="size-[30px] text-[13px]" /></span>
                <span className="grid gap-0.5 min-w-0">
                  <span className="font-display text-[1.125rem] font-semibold text-parchment whitespace-nowrap group-hover:text-parchment-strong">{t(f.nameKey)}</span>
                  <span className="text-slate text-xs whitespace-nowrap">{t(f.descKey)}</span>
                </span>
              </Link>
              {f.read(counts, t) ? (
                <span className="text-slate text-xs tracking-[0.06em] uppercase whitespace-nowrap [font-variant-numeric:tabular-nums]" aria-label={t(f.counterKey)}>{f.read(counts, t)}</span>
              ) : (
                f.emptyKey && (
                  <Link
                    to={`/p/${projectId}/${f.path}`}
                    className="text-[var(--text-faint)] hover:text-gold text-xs whitespace-nowrap no-underline transition-colors"
                  >
                    {t(f.emptyKey)}
                  </Link>
                )
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
