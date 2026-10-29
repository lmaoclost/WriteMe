import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "./theme";

const BUTTON =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-ink px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-gold-dim hover:text-parchment focus-visible:border-gold focus-visible:text-parchment";

/** Single button: shows the mode it will switch to (icon matches the target). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const toDay = theme === "night";
  const label = toDay ? t("common.switchToDay") : t("common.switchToNight");
  const short = toDay ? t("common.dayMode") : t("common.nightMode");
  return (
    <button
      type="button"
      className={BUTTON + (className ? ` ${className}` : "")}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {toDay
        ? <Sun aria-hidden className="size-3.5 opacity-80" />
        : <Moon aria-hidden className="size-3.5 opacity-80" />}
      <span>{short}</span>
    </button>
  );
}
