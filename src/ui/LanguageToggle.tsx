import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { otherLanguage, useLanguage } from "../i18n";

const BUTTON =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-ink px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-gold-dim hover:text-parchment focus-visible:border-gold focus-visible:text-parchment";

/** Single button: shows the language it will switch to. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguage();
  const target = otherLanguage(language);
  const targetName = target === "pt-BR"
    ? t("common.languages.portuguese")
    : t("common.languages.english");
  const label = t("common.switchTo", { language: targetName });

  return (
    <button
      type="button"
      className={BUTTON + (className ? ` ${className}` : "")}
      onClick={toggleLanguage}
      aria-label={label}
      title={label}
    >
      <Languages aria-hidden className="size-3.5 opacity-80" />
      <span lang={target}>{target === "pt-BR" ? "PT" : "EN"}</span>
    </button>
  );
}
