import { Link, useOutletContext } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { selectCounts, selectProject, useScriptorium } from "../../data/store";
import type { ProjectCounts } from "../../data/store";
import { fileToDataUrl } from "../../data/image";
import { Seal } from "../../ui/Seal";

export interface WorkspaceContext {
  projectId: string;
}

interface LedgerDef {
  letter: string;
  name: string;
  path: string;
  counter: string;
  read: (c: ProjectCounts) => string;
}

const LEDGER: LedgerDef[] = [
  { letter: "T", name: "Codex", path: "entries", counter: "Codex entries", read: (c) => c.entries > 0 ? String(c.entries) : "\u2014" },
  { letter: "A", name: "Atlas", path: "atlas", counter: "Atlas pins", read: (c) => c.atlasPins > 0 ? `${c.atlasRegions} regions · ${c.atlasPins} pins` : "\u2014" },
  { letter: "B", name: "Bloodline", path: "bloodline", counter: "Bloodline persons", read: (c) => c.bloodlinePersons > 0 ? String(c.bloodlinePersons) : "\u2014" },
  { letter: "O", name: "Oaths", path: "oaths", counter: "Oaths members", read: (c) => c.oathMembers > 0 ? String(c.oathMembers) : "\u2014" },
  { letter: "F", name: "Factions", path: "factions", counter: "Factions", read: (c) => c.factions > 0 ? String(c.factions) : "\u2014" },
  { letter: "C", name: "Calendar", path: "calendar", counter: "Calendar events", read: (c) => c.calendarEvents > 0 ? String(c.calendarEvents) : "\u2014" },
  { letter: "L", name: "Plot board", path: "plotboard", counter: "Plot board cards", read: (c) => c.plotCards > 0 ? String(c.plotCards) : "\u2014" },
  { letter: "W", name: "Timeline wheel", path: "linewheel", counter: "Timeline beads", read: (c) => c.timelineBeads > 0 ? String(c.timelineBeads) : "\u2014" },
  { letter: "K", name: "Wellspring", path: "wellspring", counter: "Wellspring nodes", read: (c) => c.wellspringNodes > 0 ? String(c.wellspringNodes) : "\u2014" },
  { letter: "K2", name: "Conlang", path: "conlang", counter: "Conlang words", read: (c) => c.conlangWords > 0 ? String(c.conlangWords) : "\u2014" },
  { letter: "M", name: "Manuscript", path: "manuscript", counter: "Manuscript chapters", read: (c) => c.chapters > 0 ? String(c.chapters) : "\u2014" },
  { letter: "S", name: "Bindery", path: "bindery", counter: "Bindery trims", read: () => "\u2726" },
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
    <div className="mx-auto h-full max-w-[960px] overflow-y-auto pt-7 px-6 pb-16">
      <header className="grid gap-[18px]">
        <label className="group relative block h-[200px] rounded-lg border border-line overflow-hidden bg-[radial-gradient(ellipse_120%_80%_at_30%_20%,color-mix(in_srgb,var(--accent)_14%,var(--night-2)),var(--night))] cursor-pointer hover:border-gold-dim">
          {project?.coverImageKey && images[project.coverImageKey] && (
            <img src={images[project.coverImageKey]} alt="" className="block h-full w-full object-cover" />
          )}
          <span className="absolute right-3 bottom-3 bg-[color-mix(in_srgb,var(--ink)_88%,var(--gold)_4%)] text-parchment border border-gold-dim rounded-sm px-2.5 py-1.5 text-xs tracking-[0.04em] shadow-[0_18px_40px_rgb(16_16_30/0.55)] group-hover:border-gold group-hover:text-parchment-strong">Change cover</span>
          <input
            type="file"
            accept="image/*"
            aria-label="Change cover"
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

      <section className="mt-[30px]" aria-label="Forge ledger">
        <ul className="list-none m-0 p-0 grid grid-cols-2 gap-x-14 max-[760px]:grid-cols-1">
          {LEDGER.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between gap-4 py-[13px] border-t border-line odd:pr-6 even:pl-6 [&:nth-child(-n+2)]:border-t-0 max-[760px]:odd:pr-0 max-[760px]:even:pl-0 max-[760px]:[&:nth-child(-n+2)]:border-t max-[760px]:[&:nth-child(-n+2)]:border-line max-[760px]:first:border-t-0"
            >
              <Link className="group flex items-center gap-3.5 text-inherit no-underline min-w-0" to={`/p/${projectId}/${f.path}`}>
                <span><Seal letter={f.letter.slice(0, 1)} className="size-[30px] text-[13px]" /></span>
                <span className="font-display text-[1.125rem] font-semibold text-parchment whitespace-nowrap group-hover:text-parchment-strong">{f.name}</span>
              </Link>
              <span className="text-slate text-xs tracking-[0.06em] uppercase whitespace-nowrap [font-variant-numeric:tabular-nums]" aria-label={f.counter}>{f.read(counts)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
