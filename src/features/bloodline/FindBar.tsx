import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BloodlinePerson } from "../../domain/types";

export function FindBar({ persons, onPick, onClose }: {
  persons: BloodlinePerson[];
  onPick(id: string): void;
  onClose(): void;
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const q = query.trim().toLocaleLowerCase(i18n.language);
  const matches = persons.filter((p) => {
    if (!q) return false;
    const haystack = [p.name, p.suffix, p.title, p.badgeText, ...p.additionalTitles.map((t) => t.title)]
      .filter(Boolean).join(" ").toLocaleLowerCase(i18n.language);
    return haystack.includes(q);
  }).slice(0, 50);
  return (
    <div className="find-bar absolute top-3 right-[320px] z-40 bg-night-2 border border-line rounded-lg p-2.5 w-[260px]" role="dialog" aria-label={t("bloodline.find.title")} data-testid="find-bar">
      <input
        autoFocus
        aria-label={t("bloodline.find.search")}
        placeholder={t("bloodline.find.placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-ink border border-line text-parchment rounded-sm px-2 py-1.5"
      />
      <ul className="find-results list-none mt-1.5 mb-0 p-0 max-h-[200px] overflow-y-auto">
        {matches.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onPick(p.id)} className="block w-full text-left bg-none border-0 text-parchment-dim py-1 px-1.5 rounded-sm hover:bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] hover:text-parchment">{p.name}</button>
          </li>
        ))}
      </ul>
      {!q ? <p className="text-slate text-xs mt-1.5 mb-0">{t("bloodline.find.typeToSearch")}</p> : null}
      {q && matches.length === 0 ? <p className="text-slate text-xs mt-1.5 mb-0">{t("bloodline.find.noResults")}</p> : null}
    </div>
  );
}
